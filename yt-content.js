async function getTranscriptText() {
  const transcriptSelectors = [
    "ytd-transcript-renderer",
    "#transcript",
    "#segments-container",
    'yt-formatted-string[class*="segment-text"]'
  ];

  let transcriptText = "";

  transcriptSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const t = el.innerText || "";
      if (t && t.trim().length > 0) {
        transcriptText += "\n" + t;
      }
    });
  });

  transcriptText = transcriptText.trim();

  if (!transcriptText) {
    const descEl =
      document.querySelector("#description") ||
      document.querySelector("#description-inline-expander") ||
      document.querySelector("ytd-expander#description");

    if (descEl) {
      transcriptText = (descEl.innerText || "").trim();
    }
  }

  const MAX_CHARS = 8000;
  if (transcriptText.length > MAX_CHARS) {
    transcriptText = transcriptText.substring(0, MAX_CHARS);
  }

  return transcriptText;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getYouTubeText") {
    getTranscriptText()
      .then((text) => {
        sendResponse({ text });
      })
      .catch((e) => {
        console.error("YT transcript error:", e);
        sendResponse({ text: "" });
      });
    return true;
  }
});
