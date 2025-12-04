document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await browser.runtime.sendMessage({ action: "getSettings" });
    const settings = response || {};
    console.log("Załadowane ustawienia:", settings);

    const mode = settings.summaryMode || "short";
    const format = settings.summaryFormat || "paragraph";

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

document.getElementById("saveBtn").addEventListener("click", async () => {
  try {
    const selectedMode = document.querySelector('input[name="summaryMode"]:checked');
    const selectedFormat = document.querySelector(
      'input[name="summaryFormat"]:checked'
    );
    const autoCheck = document.getElementById("autoSummarize");
    const sidebarCheck = document.getElementById("showInSidebar");

    const settings = {
      summaryMode: selectedMode ? selectedMode.value : "short",
      summaryFormat: selectedFormat ? selectedFormat.value : "paragraph",
      autoSummarize: autoCheck ? autoCheck.checked : false,
      showInSidebar: sidebarCheck ? sidebarCheck.checked : true
    };

    console.log("Zapisuję ustawienia:", settings);

    await browser.runtime.sendMessage({
      action: "saveSettings",
      settings
    });

    const status = document.getElementById("status");
    status.textContent = "✓ Zapisano pomyślnie!";
    status.className = "status success";
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 2000);
  } catch (error) {
    console.error("Błąd zapisu:", error);
    const status = document.getElementById("status");
    status.textContent = "✗ Błąd zapisu!";
    status.className = "status error";
    status.style.display = "block";
  }
});

document.getElementById("summarizeBtn").addEventListener("click", () => {
  browser.runtime.sendMessage({ action: "summarizeCurrentPage" });
  window.close();
});
