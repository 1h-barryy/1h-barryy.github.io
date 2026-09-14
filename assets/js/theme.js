/* Paint the saved palette before styles load. Theme changes never restart motion. */
(function () {
  "use strict";

  var root = document.documentElement;
  var key = "barry-theme";
  var theme = "dark";
  try {
    var saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch (e) { /* Storage is optional, including in private browsing. */ }
  root.setAttribute("data-theme", theme);

  function apply(next) {
    theme = next;
    root.setAttribute("data-theme", theme);
    var button = document.querySelector(".theme-toggle");
    if (button) {
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#f2f0e9" : "#101213";
    document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme-toggle");
    if (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        apply(theme === "dark" ? "light" : "dark");
        try { localStorage.setItem(key, theme); } catch (e) { /* Keep the current palette. */ }
      });
    }
    apply(theme);
  });

  window.addEventListener("storage", function (e) {
    if (e.key === key) apply(e.newValue === "light" ? "light" : "dark");
  });
})();
