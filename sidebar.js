document.addEventListener("DOMContentLoaded", async () => {
  const contentDiv = document.getElementById("content");

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.currentSummary) {
      const newValue = changes.currentSummary.newValue;
      if (newValue) {
        displaySummary(contentDiv, newValue);
      } else {
        showEmpty(contentDiv);
      }
    }
  });

  showEmpty(contentDiv);
});

function showEmpty(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <p>Kliknij ikonę na pasku zadań i użyj przycisku w ustawieniach lub prawego przycisku myszy.</p>
    </div>
  `;
}

function displaySummary(container, summaryObj) {
  if (summaryObj.status === "pending") {
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span>Generuję podsumowanie...</span>
      </div>
    `;
    return;
  }

  if (summaryObj.status === "error" || summaryObj.error) {
    container.innerHTML = `
      <div class="error">
        <strong>Błąd:</strong> ${escapeHtml(summaryObj.error || "Nieznany błąd")}
      </div>
    `;
    return;
  }

  if (!summaryObj.data) {
    showEmpty(container);
    return;
  }

  const raw = summaryObj.summary || "";
  const cleaned = formatText(raw);
  const settings = summaryObj.settings || {};

  let innerHtml;

  if (settings.summaryFormat === "bullets") {
    const parts = cleaned
      .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (parts.length <= 1) {
      innerHtml = `<p>${cleaned}</p>`;
    } else {
      innerHtml =
        "<ul>" +
        parts.map((p) => `<li>${p}</li>`).join("") +
        "</ul>";
    }
  } else {
    innerHtml = `<p>${cleaned}</p>`;
  }

  const html = `
    <div class="summary-content">
      <div class="summary-text">
        ${innerHtml}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function formatText(text) {
  if (!text) return "";

  let noRefs = text.replace(/\[\d+\][\s\S]*$/m, "");

  let escaped = escapeHtml(noRefs);

  return escaped.replace(/\s+/g, " ").trim();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}
