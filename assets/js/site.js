/* Shared behaviour for every page: nav state, entrance, page fade. */

(function () {
  "use strict";

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The veil lifts on its own via CSS. JS only ever closes it. */
  var veil = document.querySelector(".veil");

  /* --- fade out on internal navigation ---------------------------- */
  if (veil && !calm) {
    document.addEventListener("click", function (e) {
      // Respect clicks canceled by interactions such as dragging a gallery card.
      if (e.defaultPrevented) return;
      var a = e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || a.target === "_blank") return;
      if (a.host !== window.location.host) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      e.preventDefault();
      veil.classList.add("is-closing");
      setTimeout(function () { window.location.href = href; }, 260);
    });
  }

  /* --- nav gains a backdrop once you leave the top ---------------- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var ticking = false;
    var check = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  /* --- mark the current page in the nav --------------------------- */
  var here = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__link").forEach(function (link) {
    if (link.getAttribute("href") === here) link.setAttribute("aria-current", "page");
  });
})();
