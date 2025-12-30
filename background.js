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

browser.runtime.onStartup.addListener(async () => {
  await browser.storage.session.remove("currentSummary");
});

browser.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await browser.storage.session.remove("currentSummary");
});

browser.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar-connection") {
    port.onDisconnect.addListener(async () => {
      console.log("Panel boczny zamknięty - czyszczenie podsumowania.");
      await browser.storage.session.remove("currentSummary");
    });
  }
});

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
  try {
      await browser.contextMenus.update("perplexity-summarize-page", { title: newTitle });
  } catch (e) {}
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
  if (!url || url.startsWith("about:") || url.startsWith("moz-extension:")) return false;
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

async function getPageData(tab, isSelection, selectionText) {
  const isYT = isYouTubeVideo(tab.url);

  if (isSelection && selectionText) {
    return {
      url: tab.url,
      title: tab.title,
      content: selectionText,
      isSelection: true
    };
  } else if (isYT) {
    let text = "";
    try {
      const response = await browser.tabs.sendMessage(tab.id, {
        action: "getYouTubeText"
      });
      text = (response && response.text) || "";
    } catch (e) {
      console.error("Błąd komunikacji z yt-content.js:", e);
    }

    return {
      url: tab.url,
      title: tab.title,
      content: text,
      isYouTube: true,
      isSelection: false
    };
  } else {
    const scriptResults = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMainContentWithReadability
    });

    if (!scriptResults || !scriptResults[0] || !scriptResults[0].result) {
      throw new Error("Błąd pobierania treści ze strony.");
    }
    return scriptResults[0].result;
  }
}

async function handleSummarize(tab, isSelection = false, selectionText = null, isAuto = false) {
  const settings = await loadSettings();

  try {
    await browser.storage.session.remove("currentSummary");

    if (settings.showInSidebar !== false) {
      try { await browser.sidebarAction.open(); } catch(e) {}
      
      await browser.storage.session.set({
        currentSummary: { settings, timestamp: Date.now(), status: "pending" }
      });
    }

    const data = await getPageData(tab, isSelection, selectionText);
    console.log("Generuję podsumowanie. Tryb:", settings.summaryMode);

    if (settings.showInSidebar === false) {
      await openPerplexityForTab(data, settings);
      return;
    }

    const summary = await generateSummaryWithPerplexity(data, settings);

    await browser.storage.session.set({
      currentSummary: { data, summary, settings, timestamp: Date.now(), status: "complete" }
    });

    browser.action.setBadgeBackgroundColor({ color: "#00a400" });
    browser.action.setBadgeTextColor({ color: "#ffffff" });
    browser.action.setBadgeText({ text: "✓" });
    setTimeout(() => browser.action.setBadgeText({ text: "" }), 2000);
  } catch (error) {
    console.error("Błąd handleSummarize:", error);

    await browser.storage.session.set({
      currentSummary: { error: error.message, timestamp: Date.now(), status: "error" }
    });

    browser.action.setBadgeBackgroundColor({ color: "#ff0000" });
    browser.action.setBadgeTextColor({ color: "#ffffff" });
    browser.action.setBadgeText({ text: "!" });
    setTimeout(() => browser.action.setBadgeText({ text: "" }), 3000);
  }
}

async function generateSummaryWithPerplexity(data, settings) {
  let content = data.content || "";

  const MAX_INPUT_CHARS = 6000;
  if (content.length > MAX_INPUT_CHARS) {
    content = content.substring(0, MAX_INPUT_CHARS);
  }

  let lengthHint;
  let maxTokens;

  if (settings.summaryMode === "long") {
    lengthHint = "w 7–10 zdaniach, dość szczegółowo";
    maxTokens = 700;
  } else {
    lengthHint = "w 3–5 zdaniach, zwięźle i konkretnie";
    maxTokens = 400;
  }

  const formatHint =
    settings.summaryFormat === "bullets"
      ? "zastosuj listę punktów (punkty wypunktowane, jeden punkt = jedna myśl)"
      : "zastosuj jeden zwarty akapit (bez list wypunktowanych)";

  let prompt;
  if (data.isYouTube) {
    prompt = `Podsumuj ten film na YouTube ${lengthHint}. ${formatHint}. Skup się na treści merytorycznej. Pomiń komentarze i reklamy. URL: ${data.url} Tytuł: ${data.title} Tekst filmu/opis:\n${content}`;
  } else if (data.isSelection) {
    prompt = `Podsumuj poniższy fragment tekstu ${lengthHint}. ${formatHint}. Traktuj go jako odrębny, krótki kontekst. Skup się wyłącznie na faktach zawartych w zaznaczeniu. Pomiń dygresje.\nTekst:\n${content}`;
  } else {
    prompt = `Podsumuj ten artykuł ${lengthHint}. ${formatHint}. Zachowaj kluczowe informacje. Pomiń dygresje i linki. URL: ${data.url}\nTreść:\n${content}`;
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.5
    })
  });

  if (!response.ok) throw new Error("API error: " + response.statusText);
  const result = await response.json();
  return result.choices[0].message.content;
}

async function openPerplexityForTab(data, settings) {
    try {
        let query;
        let lengthHint = settings.summaryMode === "long" ? "dość szczegółowo, około 7–10 zdań" : "krótko, około 3–5 zdań";
        let formatHint = settings.summaryFormat === "bullets" ? "zastosuj listę punktów" : "zastosuj jeden zwarty akapit";
        let content = data.content || "";
        const MAX_FOR_URL = 3000;
        if (content.length > MAX_FOR_URL) content = content.substring(0, MAX_FOR_URL);

        if (data.isYouTube) {
            query = `Podsumuj ten film na YouTube ${lengthHint}, skupiając się na treści, ${formatHint}. URL: ${data.url}. Tekst/opis filmu: ${content}`;
        } else if (data.isSelection) {
            query = `Podsumuj poniższy fragment tekstu ${lengthHint}, traktując go jako samodzielny kontekst. Pomiń dygresje i linki, ${formatHint}. Zaznaczony tekst: ${content}`;
        } else {
            query = `Podsumuj ten artykuł ${lengthHint}, skupiając się na najważniejszych faktach i wnioskach, ${formatHint}. Pomiń dygresje, przykłady, cytaty i linki. URL: ${data.url}. Treść artykułu: ${content}`;
        }
        const encoded = encodeURIComponent(query);
        await browser.tabs.create({ url: `https://www.perplexity.ai/?q=${encoded}` });
    } catch (e) {
        console.error("Błąd openPerplexityForTab:", e);
    }
}

function extractMainContentWithReadability() {
    try {
        const documentClone = document.cloneNode(true);
        
        const reader = new Readability(documentClone);
        const article = reader.parse();
        
        if (article && article.textContent) {
            let text = article.textContent.trim();
            
            if (text.length > 20000) {
                text = text.substring(0, 20000);
            }
            
            return {
                url: window.location.href,
                title: article.title || document.title,
                content: text,
                isSelection: false
            };
        }
        
        return extractMainContent();
        
    } catch (error) {
        console.error("Błąd Readability, używam fallback:", error);
        return extractMainContent();
    }
}

function extractMainContent() {
    const selectors = ["article", '[role="article"]', "main", '[role="main"]', ".post-content", ".entry-content", ".article-content", ".story-body", ".article-body"];
    let element = document.querySelector(selectors.join(", ")) || document.body;
    const clone = element.cloneNode(true);
    const toRemove = clone.querySelectorAll('[class*="ad-"], [class*="adv-"], .advertisement, [id*="ad-"], [id*="adv-"], [data-ad-slot], [data-ad-region], .advert, .promoted, .sponsored, .social-share, .social-widget, nav, .navbar, .navigation, footer, .footer, .comments-section, .comment-section, .sidebar, [role="complementary"], iframe, .modal, .popup, .cookie-banner, .metabar');
    toRemove.forEach((el) => el.remove());
    let text = clone.innerText || "";
    text = text.replace(/\s+/g, " ").trim();
    if (text.length > 20000) text = text.substring(0, 20000);
    return { url: window.location.href, title: document.title, content: text, isSelection: false };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    loadSettings().then(sendResponse);
    return true;
  } else if (message.action === "saveSettings") {
    browser.storage.local
      .set({ settings: message.settings })
      .then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === "summarizeCurrentPage") {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs[0]) handleSummarize(tabs[0], false);
      });
    return false;
  } else if (message.action === "clearCurrentSummary") {
    browser.storage.session
      .remove("currentSummary")
      .then(() => sendResponse({ success: true }));
    return true;
  }
});
