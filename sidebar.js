browser.runtime.connect({ name: "sidebar-connection" });

document.addEventListener("DOMContentLoaded", async () => {
  const contentDiv = document.getElementById("content");

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session") {
      if (changes.currentSummary) {
        const newValue = changes.currentSummary.newValue;
        if (newValue) {
          displaySummary(contentDiv, newValue);
        } else {
          showEmpty(contentDiv);
        }
      }
    }
  });

  const stored = await browser.storage.session.get("currentSummary");
  if (stored && stored.currentSummary) {
    displaySummary(contentDiv, stored.currentSummary);
  } else {
    showEmpty(contentDiv);
  }
});

function showEmpty(container) {
  container.innerHTML =
    '<div class="empty-state"><div class="empty-state-icon">📄</div><p>Kliknij ikonę na pasku zadań, aby podsumować bieżącą stronę lub użyj prawego przycisku myszy.</p></div>';
}

function displaySummary(container, state) {
  if (state.status === "error") {
    container.innerHTML = `<div class="error">Błąd: ${state.error || "Nieznany błąd."}</div>`;
    return;
  }

  if (state.status === "pending") {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><span>Generuję podsumowanie...</span></div>`;
    return;
  }

  const summary = state.summary || "";

  if (!summary || summary.trim().length === 0) {
    if (state.status === "complete") {
         container.innerHTML = '<div class="error">Otrzymano puste podsumowanie.</div>';
    } else {
         showEmpty(container);
    }
    return;
  }

  let html = `<div class="summary-content"><div class="summary-text">`;

  if (typeof summary === "string") {
    const hasMarkdown = /(\*\*|__|##|\[.*\]\(.*\)|^\s*[-*+]\s|^\s*\d+\.\s)/m.test(summary);
    
    if (hasMarkdown && typeof marked !== 'undefined') {
      try {
        const rendered = marked.parse(summary);
        html += rendered;
      } catch (e) {
        console.error("Błąd parsowania markdown:", e);
        html += renderSimpleFormat(summary);
      }
    } else {
      html += renderSimpleFormat(summary);
    }
  }

  html += `</div></div>`;
  container.innerHTML = html;
}

function renderSimpleFormat(summary) {
  let html = "";
  const lines = summary.split("\n").filter((line) => line.trim());

  const isList = lines.some(
    (line) => /^[\s]*([•\-\*\+]|\d+\.)[\s]/.test(line)
  ) && lines.length > 1;

  if (isList) {
    html += "<ul>";
    lines.forEach((line) => {
      const cleanLine = line
        .replace(/^[\s]*([•\-\*\+]|\d+\.)[\s]+/, "")
        .trim();
      if (cleanLine) {
        html += `<li>${cleanLine}</li>`;
      }
    });
    html += "</ul>";
  } else {
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        html += `<p>${trimmed}</p>`;
      }
    });
  }
  
  return html;
}
