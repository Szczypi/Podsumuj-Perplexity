const PERPLEXITY_API_KEY = "KLUCZ_API_PERPLEXITY";
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

const defaultSettings = {
  summaryMode: "long",
  summaryFormat: "bullets",
  autoSummarize: false,
  showInSidebar: true
};

async function loadSettings() {
  const stored = await browser.storage.local.get("settings");
  if (!stored.settings) {
    await browser.storage.local.set({ settings: defaultSettings });
    return defaultSettings;
  }
  return stored.settings;
}

browser.runtime.onInstalled.addListener(loadSettings);

browser.contextMenus.create(
  {
    id: "perplexity-summarize-page",
    title: "Podsumuj bieżącą stronę",
    contexts: ["page"]
  },
  () => browser.runtime.lastError
);

browser.contextMenus.create(
  {
    id: "perplexity-summarize-selection",
    title: "Podsumuj zaznaczony tekst",
    contexts: ["selection"]
  },
  () => browser.runtime.lastError
);

function isYouTubeVideo(url) {
  return url && (url.includes("youtube.com/watch") || url.includes("youtu.be/"));
}

async function updateContextMenu(tab) {
  if (!tab || !tab.url) return;
  const isYT = isYouTubeVideo(tab.url);
  const newTitle = isYT ? "Podsumuj ten film na YouTube" : "Podsumuj bieżącą stronę";
  browser.contextMenus.update("perplexity-summarize-page", {
    title: newTitle
  });
}

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateContextMenu(tab);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateContextMenu(tab);

    const settings = await loadSettings(); 

    if (settings.autoSummarize === true) {
      if (isArticlePage(tab.url) || isYouTubeVideo(tab.url)) {
        console.log("Auto-summarizing:", tab.url);
        setTimeout(() => handleSummarize(tab, false, null, true), 2000);
      }
    }
  }
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "perplexity-summarize-page") {
    await handleSummarize(tab, false);
  } else if (info.menuItemId === "perplexity-summarize-selection") {
    await handleSummarize(tab, true, info.selectionText);
  }
});

function isArticlePage(url) {
  if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) {
    return false;
  }
  const patterns = [
    /\/article\//,
    /\/post\//,
    /\/blog\//,
    /\/news\//,
    /\/\d{4}\//,
    /\.html$/,
    /\/artykul\//,
    /\/wiadomosc\//,
    /\/story\//,
    /\/entry\//,
    /\/content\//
  ];
  return patterns.some((p) => p.test(url));
}

async function handleSummarize(tab, isSelection = false, selectionText = null, isAuto = false) {
  const settings = await loadSettings();
  const isYT = isYouTubeVideo(tab.url);

  if (settings.showInSidebar === false) {
    await openPerplexityForTab(tab, isSelection, selectionText, settings);
    return;
  }

  try {
    let data;
    
    if (isSelection && selectionText) {
      data = {
        url: tab.url,
        title: tab.title,
        content: selectionText,
        isSelection: true
      };
    } else if (isYT) {
      data = {
        url: tab.url,
        title: tab.title,
        content: "", 
        isYouTube: true,
        isSelection: false
      };
    } else {
      const scriptResults = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMainContent
      });
      if (!scriptResults || !scriptResults[0]) {
        throw new Error("Błąd pobierania treści");
      }
      data = scriptResults[0].result;
    }

    await browser.storage.local.set({
      currentSummary: {
        data,
        settings,
        timestamp: Date.now(),
        status: "pending"
      }
    });

    const summary = await generateSummaryWithPerplexity(data, settings);

    await browser.storage.local.set({
      currentSummary: {
        data,
        summary,
        settings,
        timestamp: Date.now(),
        status: "complete"
      }
    });

    browser.action.setBadgeBackgroundColor({ color: "#00a400" });
    browser.action.setBadgeTextColor({ color: "#ffffff" });
    browser.action.setBadgeText({ text: "✓" });
    setTimeout(() => browser.action.setBadgeText({ text: "" }), 2000);
  } catch (error) {
    console.error("Błąd handleSummarize:", error);

    await browser.storage.local.set({
      currentSummary: {
        error: error.message,
        timestamp: Date.now(),
        status: "error"
      }
    });

    browser.action.setBadgeBackgroundColor({ color: "#ff0000" });
    browser.action.setBadgeTextColor({ color: "#ffffff" });
    browser.action.setBadgeText({ text: "!" });
    setTimeout(() => browser.action.setBadgeText({ text: "" }), 3000);
  }
}

async function generateSummaryWithPerplexity(data, settings) {
  let content = data.content || "";
  if (content.length > 5000) {
    content = content.substring(0, 5000);
  }

  let lengthHint;
  let maxTokens;

  if (settings.summaryMode === "long") {
    lengthHint = "w 10-15 zdaniach, szczegółowo i wyczerpująco";
    maxTokens = 1200;
  } else {
    lengthHint = "w 5–8 zdaniach, z najważniejszymi szczegółami";
    maxTokens = 600;
  }

  let prompt;

  if (data.isYouTube) {
    prompt = `Podsumuj ten film na YouTube ${lengthHint}.
Skup się wyłącznie na głównej treści merytorycznej wideo.
Pomiń sekcję komentarzy, reklamy oraz sprawy techniczne.
Zachowaj tylko kluczowe informacje: o czym jest film i jakie są główne wnioski.

URL filmu: ${data.url}
Tytuł filmu: ${data.title}`;
  }
  else if (data.isSelection) {
    prompt = `Jesteś narzędziem do podsumowywania tekstu.
Podsumuj poniższy tekst ${lengthHint}.
**ABSOLUTNIE nie korzystaj z Internetu, wiedzy ogólnej ani kontekstu spoza tego tekstu.**
Skup się wyłącznie na najważniejszych faktach i wnioskach.
Pomiń przykłady, dygresje, cytaty, opinie i źródła.

Tekst:
${content}`;
  } 
  else {
    prompt = `Podsumuj ten artykuł ${lengthHint}.
Zachowaj tylko kluczowe informacje: kto/co, gdzie, kiedy, dlaczego i z jakim skutkiem.
Pomiń tło, dygresje, cytaty, opinie oraz jakiekolwiek linki lub przypisy.

URL artykułu: ${data.url}
Treść artykułu:
${content}`;
  }

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Perplexity API error: ${errorData?.error?.message || "Unknown error"}`
      );
    }

    const result = await response.json();
    if (result.choices && result.choices[0] && result.choices[0].message) {
      return result.choices[0].message.content;
    }
    throw new Error("Unexpected API response format");
  } catch (error) {
    console.error("Error calling Perplexity API:", error);
    throw new Error(`Błąd API Perplexity: ${error.message}`);
  }
}

async function openPerplexityForTab(tab, isSelection, selectionText, settings) {
  try {
    const isYT = isYouTubeVideo(tab.url);
    let query;

    let lengthHint = settings.summaryMode === "long" ? "dość szczegółowo, około 10-15 zdań" : "krótko, około 5–8 zdań";
    let formatHint = settings.summaryFormat === "bullets" ? "zastosuj listę punktów" : "zastosuj jeden zwarty akapit";

    if (isYT && !isSelection) {
        query = `Podsumuj ten film na YouTube ${lengthHint}, skupiając się na treści, ${formatHint}. URL: ${tab.url}`;
    } else {
        let data;
        if (isSelection && selectionText) {
          data = {
            url: tab.url,
            title: tab.title,
            content: selectionText,
            isSelection: true
          };
        } else {
          const scriptResults = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractMainContent
          });
          if (!scriptResults || !scriptResults[0]) {
            throw new Error("Błąd pobierania treści");
          }
          data = scriptResults[0].result;
        }

        let content = data.content || "";
        if (content.length > 4000) {
          content = content.substring(0, 4000);
        }
        
        query = `Podsumuj ten artykuł ${lengthHint}, skupiając się na najważniejszych faktach i wnioskach, ${formatHint}. Pomiń dygresje, przykłady, cytaty i linki. URL: ${data.url}. Treść artykułu: ${content}`;
    }

    const encoded = encodeURIComponent(query);
    await browser.tabs.create({
      url: `https://www.perplexity.ai/?q=${encoded}`
    });
  } catch (e) {
    console.error("Błąd openPerplexityForTab:", e);
  }
}

function extractMainContent() {
  const selectors = [
    "article",
    '[role="article"]',
    ".post-content",
    ".entry-content",
    ".article-content",
    ".story-body",
    ".article-body",
    "main",
    '[role="main"]'
  ];

  let element = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.length > 200) {
      element = el;
      break;
    }
  }
  if (!element) element = document.body;

  const clone = element.cloneNode(true);

  const toRemove = clone.querySelectorAll(
    '[class*="ad-"], [class*="adv-"], .advertisement,' +
      '[id*="ad-"], [id*="adv-"],' +
      "[data-ad-slot], [data-ad-region]," +
      ".advert, .promoted, .sponsored," +
      ".social-share, .social-widget," +
      '[class*="-share-"], [id*="-share-"],' +
      "a[data-social], a[data-share]," +
      '[class*="paywall"], .paywall-prompt,' +
      '[class*="meter-"], .meter-prompt,' +
      ".unlock-prompt, .subscribe-prompt," +
      '[class*="subscription-"],' +
      '[class*="newsletter-"], .newsletter-signup,' +
      ".myft-digest, [class*=\"digest\"]," +
      '[class*="email-"], .email-signup,' +
      "nav, .navbar, .navigation," +
      ".breadcrumb, .pagination," +
      "footer, .footer," +
      ".comments-section, .comment-section," +
      ".sidebar, [role=\"complementary\"]," +
      ".related-articles, .recommended," +
      '[class*=\"trending\"], [class*=\"popular\"],' +
      "figcaption, [class*=\"caption\"]," +
      "[class*=\"image-caption\"], .photo-credit," +
      ".image-description, .picture-caption," +
      '[class*=\"byline\"], [class*=\"author\"],' +
      '[class*=\"timestamp\"], [class*=\"publish\"],' +
      '[class*=\"date-\"], .article-meta,' +
      ".meta, [class*=\"-meta\"]," +
      '[class*=\"author-\"], [class*=\"by-\"],' +
      ".published-date, .update-date," +
      'iframe[src*="youtube"],' +
      'iframe[src*="vimeo"],' +
      'iframe[src*="twitter"],' +
      'iframe[src*="facebook"],' +
      ".modal, .popup, [role=\"dialog\"]," +
      ".overlay, .lightbox"
  );

  toRemove.forEach((el) => el.remove());

  let text = clone.innerText || "";
  text = text.replace(/\s+/g, " ").trim();

  text = text.replace(/\s*Visit our[^.]*?(hub|platform)[^.]*?(?:\.|and)\s*/gi, " ");
  text = text.replace(/\s*Odwiedź[^.]*?(hub|platformę)[^.]*?FT[^.]*?(?:\.|oraz)\s*/gi, " ");
  text = text.replace(/\s+/g, " ").trim();

  const sentences = text.split(/(?<=[.!?])\s+/);
  const uniqueSentences = [];
  const seen = new Set();
  sentences.forEach((sent) => {
    const norm = sent.toLowerCase().trim();
    if (!seen.has(norm) && sent.trim().length > 0) {
      seen.add(norm);
      uniqueSentences.push(sent);
    }
  });
  text = uniqueSentences.join(" ");
  if (text.length > 20000) text = text.substring(0, 20000);

  return {
    url: window.location.href,
    title: document.title,
    content: text,
    isSelection: false
  };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    loadSettings().then(sendResponse);
    return true; 
  } else if (message.action === "saveSettings") {
    browser.storage.local.set({ settings: message.settings })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error("Błąd zapisu ustawień w storage:", error);
          sendResponse({ success: false, error: error.message });
        });
    return true; 
  } else if (message.action === "summarizeCurrentPage") {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) handleSummarize(tabs[0], false);
    });
    return false;
  } else if (message.action === "clearCurrentSummary") {
    browser.storage.local.set({ currentSummary: null }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
