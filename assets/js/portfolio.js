/* Portfolio scroll behaviour: reading progress, plate entrance, text beats. */

(function () {
  "use strict";

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- reading progress -------------------------------------------- */
  var bar = document.querySelector(".progress");

  /* --- plates track their own position in the viewport -------------- */
  var plates = [].slice.call(document.querySelectorAll(".plate"));

  function update() {
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    }

    if (calm) return;

    var vh = window.innerHeight;
    for (var i = 0; i < plates.length; i++) {
      var r = plates[i].getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      // 0 as it enters from below, 1 once it has travelled a full screen
      var p = 1 - (r.top / vh);
      plates[i].style.setProperty("--enter", Math.max(0, Math.min(1, p)).toFixed(4));
    }
  }

  var queued = false;
  window.addEventListener("scroll", function () {
    if (!queued) { queued = true; requestAnimationFrame(function () { update(); queued = false; }); }
  }, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();

  /* --- text beats arrive as you reach them -------------------------- */
  var beats = document.querySelectorAll(".beat");

  if (calm || !("IntersectionObserver" in window)) {
    beats.forEach(function (b) { b.classList.add("is-in"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -14% 0px", threshold: 0.15 });

  beats.forEach(function (b, i) {
    b.style.transitionDelay = (i % 4) * 60 + "ms";
    io.observe(b);
  });
})();
