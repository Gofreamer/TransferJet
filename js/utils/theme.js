/* Jet Market — Tema claro / escuro */

(function () {
  const KEY = "jetmarket-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☾" : "☀";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initTheme() {
    const saved = localStorage.getItem(KEY) || "dark";
    applyTheme(saved);
  }

  window.toggleTheme = toggleTheme;
  window.initTheme = initTheme;
})();
