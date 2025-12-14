document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await browser.runtime.sendMessage({ action: "getSettings" });
    const settings = response || {};

    const mode = settings.summaryMode || "long";
    const format = settings.summaryFormat || "bullets";

    const modeRadio = document.querySelector(
      `input[name="summaryMode"][value="${mode}"]`
    );
    if (modeRadio) modeRadio.checked = true;

    const formatRadio = document.querySelector(
      `input[name="summaryFormat"][value="${format}"]`
    );
    if (formatRadio) formatRadio.checked = true;

    const autoCheck = document.getElementById("autoSummarize");
    if (autoCheck) autoCheck.checked = !!settings.autoSummarize;

    const sidebarCheck = document.getElementById("showInSidebar");
    if (sidebarCheck) sidebarCheck.checked = settings.showInSidebar !== false;
  } catch (error) {
    console.error("Błąd ładowania ustawień:", error);
  }
});

function getSettingsFromUI() {
  const selectedMode = document.querySelector('input[name="summaryMode"]:checked');
  const selectedFormat = document.querySelector('input[name="summaryFormat"]:checked');
  const autoCheck = document.getElementById("autoSummarize");
  const sidebarCheck = document.getElementById("showInSidebar");

  return {
    summaryMode: selectedMode ? selectedMode.value : "long",
    summaryFormat: selectedFormat ? selectedFormat.value : "bullets",
    autoSummarize: autoCheck ? autoCheck.checked : false,
    showInSidebar: sidebarCheck ? sidebarCheck.checked : true
  };
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  try {
    const settings = getSettingsFromUI();
    console.log("Zapisuję ustawienia:", settings);

    const response = await browser.runtime.sendMessage({
      action: "saveSettings",
      settings
    });

    const status = document.getElementById("status");
    if (response && response.success) {
      status.textContent = "✓ Zapisano pomyślnie!";
      status.className = "status success";
    } else {
      status.textContent = "✗ Błąd zapisu!";
      status.className = "status error";
    }

    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 2000);
  } catch (error) {
    console.error("Błąd zapisu:", error);
  }
});

document.getElementById("summarizeBtn").addEventListener("click", () => {
  browser.runtime.sendMessage({
    action: "summarizeCurrentPage"
  });
  window.close();
});
