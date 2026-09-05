/* =========================================================
   BarryMade — the cards are objects.
   They have mass, they collide, they settle. A lamp follows
   the cursor and only lights what is near it.
   ========================================================= */

(function () {
  "use strict";

  var stage = document.getElementById("stage");
  if (!stage) return;

  var chips = [].slice.call(stage.querySelectorAll(".chip"));
  if (!chips.length) return;

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function narrow() { return window.innerWidth < 760; }

  /* If the room won't work — small screen or motion turned off —
     the same cards become a plain lit grid. Nothing is lost. */
  if (calm || narrow()) {
    stage.classList.add("is-static");
    return;
  }

  var TUNE = {
    friction: 0.942,
    spin: 0.915,
    bounce: 0.44,
    sleep: 0.05,
    lampRadius: 250,
    nudge: 12,
    tilt: 9,
    maxThrow: 42
  };

  /* ---------- bodies ------------------------------------------------ */

  var bodies = chips.map(function (el) {
    return {
      el: el, x: 0, y: 0, vx: 0, vy: 0,
      rot: 0, vrot: 0,
      rest: (Math.random() * 2 - 1) * 3.4,
      w: 0, h: 0,
      ox: 0, oy: 0, tox: 0, toy: 0,
      tiltX: 0, tiltY: 0, tTiltX: 0, tTiltY: 0,
      lift: 0, tLift: 0,
      lit: 0, tLit: 0,
      held: false, focused: false,
      home: null
    };
  });

  var SW = 0, SH = 0;
  var mx = -9999, my = -9999, pointerIn = false;
  var homingUntil = 0;

  function measure() {
    var r = stage.getBoundingClientRect();
    SW = r.width; SH = r.height;
    bodies.forEach(function (b) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
    });
  }

  function clampInside(b) {
    b.x = Math.max(0, Math.min(SW - b.w, b.x));
    b.y = Math.max(0, Math.min(SH - b.h, b.y));
  }

  /* ---------- initial scatter, then relax so nothing overlaps -------- */

  function scatter() {
    bodies.forEach(function (b) {
      b.x = Math.random() * Math.max(1, SW - b.w);
      b.y = Math.random() * Math.max(1, SH - b.h);
      b.rot = (Math.random() * 2 - 1) * 6;
      b.rest = b.rot;
      b.vx = b.vy = b.vrot = 0;
    });
    for (var k = 0; k < 90; k++) { separate(true); bodies.forEach(clampInside); }
  }

  /* ---------- collisions: axis-aligned, resolve the shallow axis ----- */

  function separate(positionOnly) {
    for (var i = 0; i < bodies.length; i++) {
      for (var j = i + 1; j < bodies.length; j++) {
        var a = bodies[i], b = bodies[j];
        var dx = (a.x + a.w / 2) - (b.x + b.w / 2);
        var dy = (a.y + a.h / 2) - (b.y + b.h / 2);
        var px = (a.w + b.w) / 2 - Math.abs(dx);
        var py = (a.h + b.h) / 2 - Math.abs(dy);
        if (px <= 0 || py <= 0) continue;

        // a held card is immovable; the other one gets out of its way
        var aFixed = a.held, bFixed = b.held;
        var aShare = aFixed ? 0 : (bFixed ? 1 : 0.5);
        var bShare = bFixed ? 0 : (aFixed ? 1 : 0.5);

        if (px < py) {
          var sx = (dx < 0 ? -1 : 1) * px;
          a.x += sx * aShare;
          b.x -= sx * bShare;
          if (!positionOnly) {
            var mvx = (a.vx + b.vx) / 2;
            if (!aFixed) a.vx = mvx + (a.vx - mvx) * -TUNE.bounce;
            if (!bFixed) b.vx = mvx + (b.vx - mvx) * -TUNE.bounce;
            if (!aFixed) a.vrot += sx * 0.05;
            if (!bFixed) b.vrot -= sx * 0.05;
          }
        } else {
          var sy = (dy < 0 ? -1 : 1) * py;
          a.y += sy * aShare;
          b.y -= sy * bShare;
          if (!positionOnly) {
            var mvy = (a.vy + b.vy) / 2;
            if (!aFixed) a.vy = mvy + (a.vy - mvy) * -TUNE.bounce;
            if (!bFixed) b.vy = mvy + (b.vy - mvy) * -TUNE.bounce;
          }
        }
      }
    }
  }

  /* ---------- pointer ----------------------------------------------- */

  function toStage(e) {
    var r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  stage.addEventListener("pointermove", function (e) {
    var p = toStage(e);
    mx = p.x; my = p.y;
    pointerIn = true;
    if (fine) {
      stage.classList.add("is-lit");
      stage.style.setProperty("--mx", mx + "px");
      stage.style.setProperty("--my", my + "px");
    }
  }, { passive: true });

  stage.addEventListener("pointerleave", function () {
    pointerIn = false;
    mx = my = -9999;
    stage.classList.remove("is-lit");
  });

  /* ---------- grabbing ------------------------------------------------ */

  bodies.forEach(function (b) {
    var grabX = 0, grabY = 0, travelled = 0, pid = null;

    b.el.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      pid = e.pointerId;
      try { b.el.setPointerCapture(pid); } catch (err) {}
      var p = toStage(e);
      mx = p.x; my = p.y;
      grabX = p.x - b.x;
      grabY = p.y - b.y;
      travelled = 0;
      b.held = true;
      b.vx = b.vy = b.vrot = 0;
      b.el.classList.add("is-held");
      homingUntil = 0;
    });

    b.el.addEventListener("pointermove", function (e) {
      if (!b.held) return;
      var p = toStage(e);
      mx = p.x; my = p.y;
      var nx = p.x - grabX, ny = p.y - grabY;
      var dx = nx - b.x, dy = ny - b.y;
      travelled += Math.abs(dx) + Math.abs(dy);
      b.x = nx; b.y = ny;
      // remember the hand's speed so the release can carry it
      b.vx = b.vx * 0.35 + dx * 0.65;
      b.vy = b.vy * 0.35 + dy * 0.65;
      b.rot += Math.max(-2.5, Math.min(2.5, dx * 0.07));
      clampInside(b);
    });

    function release() {
      if (!b.held) return;
      b.held = false;
      b.el.classList.remove("is-held");
      var m = Math.hypot(b.vx, b.vy);
      if (m > TUNE.maxThrow) { b.vx *= TUNE.maxThrow / m; b.vy *= TUNE.maxThrow / m; }
      b.vrot = Math.max(-9, Math.min(9, b.vx * 0.28));
      b.rest = (Math.random() * 2 - 1) * 3.4;
      if (pid !== null) { try { b.el.releasePointerCapture(pid); } catch (err) {} pid = null; }
    }

    b.el.addEventListener("pointerup", release);
    b.el.addEventListener("pointercancel", release);

    // a drag is not a click
    b.el.addEventListener("click", function (e) {
      if (travelled > 6) { e.preventDefault(); travelled = 0; }
    });

    b.el.addEventListener("focus", function () { b.focused = true; });
    b.el.addEventListener("blur", function () { b.focused = false; });
  });

  /* ---------- tidy up ------------------------------------------------- */

  var tidyBtn = document.querySelector(".tidy");
  if (tidyBtn) {
    tidyBtn.addEventListener("click", function () {
      var cw = bodies[0].w, ch = bodies[0].h;
      var gap = 16;
      var cols = Math.max(1, Math.floor((SW + gap) / (cw + gap)));
      var rows = Math.ceil(bodies.length / cols);
      var padX = Math.max(0, (SW - (cols * cw + (cols - 1) * gap)) / 2);
      var padY = Math.max(0, (SH - (rows * ch + (rows - 1) * gap)) / 2);
      bodies.forEach(function (b, i) {
        b.home = {
          x: padX + (i % cols) * (cw + gap),
          y: padY + Math.floor(i / cols) * (ch + gap)
        };
        b.rest = 0;
      });
      homingUntil = performance.now() + 900;
    });
  }

  /* ---------- loop ----------------------------------------------------- */

  function smoothstep(e0, e1, v) {
    var t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  var cleaned = false;

  function step(now) {
    // resized down into the static grid: hand the cards back to CSS
    if (stage.classList.contains("is-static")) {
      if (!cleaned) {
        bodies.forEach(function (o) {
          o.el.style.transform = "";
          o.el.style.removeProperty("--lit");
        });
        cleaned = true;
      }
      requestAnimationFrame(step);
      return;
    }
    cleaned = false;

    var homing = now < homingUntil;

    // which card is under the cursor — topmost wins
    var hovered = -1;
    if (pointerIn) {
      for (var h = bodies.length - 1; h >= 0; h--) {
        var c = bodies[h];
        if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) { hovered = h; break; }
      }
    }

    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];

      if (homing && b.home && !b.held) {
        b.x += (b.home.x - b.x) * 0.14;
        b.y += (b.home.y - b.y) * 0.14;
        b.rot += (0 - b.rot) * 0.14;
        b.vx = b.vy = b.vrot = 0;
      } else if (!b.held) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vrot;
        b.vx *= TUNE.friction;
        b.vy *= TUNE.friction;
        b.vrot *= TUNE.spin;

        // edges of the table
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * TUNE.bounce; b.vrot -= b.vy * 0.05; }
        if (b.x + b.w > SW) { b.x = SW - b.w; b.vx = -Math.abs(b.vx) * TUNE.bounce; b.vrot += b.vy * 0.05; }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * TUNE.bounce; }
        if (b.y + b.h > SH) { b.y = SH - b.h; b.vy = -Math.abs(b.vy) * TUNE.bounce; }

        // once it is almost still, let it settle instead of jittering
        if (Math.hypot(b.vx, b.vy) < TUNE.sleep && Math.abs(b.vrot) < TUNE.sleep) {
          b.vx = b.vy = b.vrot = 0;
          b.rot += (b.rest - b.rot) * 0.06;
        }
      }

      // lamp falloff
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      var d = pointerIn ? Math.hypot(mx - cx, my - cy) : 99999;
      if (!fine) {
        b.tLit = 1;                       // no hover to speak of — light it all
      } else if (!pointerIn) {
        b.tLit = 0.5;                     // room light: dim, but everything readable
      } else {
        b.tLit = 0.12 + 0.88 * (1 - smoothstep(60, TUNE.lampRadius, d));
      }
      if (b.held || b.focused) b.tLit = 1;

      // nearby cards ease away from the light, which reads as depth
      if (!b.held && pointerIn && d > 1) {
        var push = Math.max(0, 1 - d / (TUNE.lampRadius + 60)) * TUNE.nudge;
        b.tox = ((cx - mx) / d) * push;
        b.toy = ((cy - my) / d) * push;
      } else { b.tox = 0; b.toy = 0; }

      // tilt only the card you are actually over
      if (i === hovered && !b.held) {
        b.tTiltY = ((mx - b.x) / b.w - 0.5) * TUNE.tilt;
        b.tTiltX = -((my - b.y) / b.h - 0.5) * TUNE.tilt;
        b.tLift = 1;
      } else if (b.held) {
        b.tTiltY = b.tTiltX = 0;
        b.tLift = 1;
      } else {
        b.tTiltY = b.tTiltX = 0;
        b.tLift = 0;
      }
    }

    if (!homing) separate(false);
    for (var k = 0; k < bodies.length; k++) if (!bodies[k].held) clampInside(bodies[k]);

    // ease the cosmetic channels so nothing snaps
    for (var r = 0; r < bodies.length; r++) {
      var o = bodies[r];
      o.ox += (o.tox - o.ox) * 0.09;
      o.oy += (o.toy - o.oy) * 0.09;
      o.tiltX += (o.tTiltX - o.tiltX) * 0.13;
      o.tiltY += (o.tTiltY - o.tiltY) * 0.13;
      o.lift += (o.tLift - o.lift) * 0.12;
      o.lit += (o.tLit - o.lit) * 0.14;

      var z = o.lift * 26 + (o.held ? 34 : 0);
      o.el.style.transform =
        "translate3d(" + (o.x + o.ox).toFixed(2) + "px," + (o.y + o.oy).toFixed(2) + "px," + z.toFixed(1) + "px)" +
        " rotate(" + o.rot.toFixed(2) + "deg)" +
        " rotateX(" + o.tiltX.toFixed(2) + "deg) rotateY(" + o.tiltY.toFixed(2) + "deg)";
      o.el.style.setProperty("--lit", o.lit.toFixed(3));
    }

    requestAnimationFrame(step);
  }

  /* ---------- go -------------------------------------------------------- */

  function boot() {
    if (narrow()) { stage.classList.add("is-static"); return; }
    stage.classList.remove("is-static");
    measure();
    scatter();
  }

  boot();
  requestAnimationFrame(step);

  // card height depends on the loaded typeface, so measure again once it lands
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (stage.classList.contains("is-static")) return;
      measure();
      for (var k = 0; k < 40; k++) { separate(true); bodies.forEach(clampInside); }
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (narrow()) { stage.classList.add("is-static"); return; }
      var wasStatic = stage.classList.contains("is-static");
      stage.classList.remove("is-static");
      measure();
      if (wasStatic) scatter();      // coming back from the grid: lay them out afresh
      else bodies.forEach(clampInside);
    }, 160);
  }, { passive: true });
})();
