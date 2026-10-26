/* Homepage discovery. Native anchors remain usable independently of WebGL. */
(function () {
  "use strict";
  var root = document.querySelector(".cosmos");
  if (!root) return;
  var links = Array.prototype.slice.call(root.querySelectorAll(".celestial"));
  var active = null, mode = "", input = "keyboard", keyboardFocus = null;
  var tapLink = null, tapReady = false;
  var removers = [];
  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    removers.push(function () { target.removeEventListener(type, fn, options); });
  }
  function linkAt(target) {
    var link = target && target.closest ? target.closest(".celestial") : null;
    return links.indexOf(link) >= 0 ? link : null;
  }
  function select(next, source) {
    active = next; mode = next ? source : "";
    links.forEach(function (link) {
      link.classList.toggle("is-active", link === next);
      // On a switch, retire the old annotation before revealing the next.
      // On a simple exit, allow its normal fade-out to finish.
      link.classList.toggle("is-superseded", !!next && link !== next);
      link.setAttribute("aria-expanded", String(link === next));
    });
    document.dispatchEvent(new CustomEvent("cosmoschange", {detail: {anchor: next}}));
  }
  root.setAttribute("data-discovery", "ready");
  links.forEach(function (link) {
    link.setAttribute("aria-expanded", "false");
    listen(link, "pointerenter", function (e) {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") select(link, "pointer");
    });
    listen(link, "pointerleave", function () {
      if (active === link && mode === "pointer") select(keyboardFocus, "keyboard");
    });
    listen(link, "focus", function () {
      // Touch focus must not arm navigation before the first tap's click.
      if (input === "keyboard") { keyboardFocus = link; select(link, "keyboard"); }
    });
    listen(link, "blur", function () {
      if (keyboardFocus === link) keyboardFocus = null;
      if (active === link && mode === "keyboard") select(null, "");
    });
  });
  listen(document, "pointerdown", function (e) {
    input = e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "pointer";
    keyboardFocus = null;
    var link = linkAt(e.target);
    tapLink = input === "touch" ? link : null;
    tapReady = !!link && active === link && mode === "touch";
    if (!link) select(null, "");
  }, true);
  // Capture cancels the first tap before the shared page-transition listener.
  listen(root, "click", function (e) {
    var link = linkAt(e.target);
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (e.detail !== 0 && input === "touch" && tapLink === link) {
      if (!tapReady) { e.preventDefault(); select(link, "touch"); }
      tapLink = null; tapReady = false;
    }
    // Keyboard / assistive-tech activation (detail 0) and mouse clicks navigate.
  }, true);
  listen(document, "keydown", function (e) {
    input = "keyboard"; tapLink = null; tapReady = false;
    if (e.key === "Escape") { keyboardFocus = null; select(null, ""); }
  }, true);
  listen(document, "pointercancel", function () { tapLink = null; tapReady = false; select(null, ""); });
  listen(window, "blur", function () { keyboardFocus = null; select(null, ""); });
  listen(window, "pagehide", function (e) {
    select(null, "");
    if (!e.persisted) removers.forEach(function (remove) { remove(); });
  });
  listen(window, "pageshow", function () {
    tapLink = null; tapReady = false;
    keyboardFocus = input === "keyboard" ? linkAt(document.activeElement) : null;
    select(keyboardFocus, "keyboard");
  });
})();
