/* Jet Market — Tema claro / escuro */

(function () {
  const KEY = "jetmarket-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(KEY, theme); } catch (_) {}
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.textContent = theme === "light" ? "☾" : "☀";
      btn.setAttribute("aria-label", theme === "light" ? "Ativar tema escuro" : "Ativar tema claro");
      btn.setAttribute("aria-pressed", String(theme === "light"));
    }
    document.dispatchEvent(new CustomEvent("theme:changed"));
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initTheme() {
    let saved = "dark";
    try { saved = localStorage.getItem(KEY) || "dark"; } catch (_) {}
    if (!["dark", "light"].includes(saved)) saved = "dark";
    applyTheme(saved);
  }

  window.toggleTheme = toggleTheme;
  window.initTheme = initTheme;
})();
