/* =========================================================
   Ambient particle field — raw WebGL, no dependencies.
   Drift, depth fog and cursor repulsion all run on the GPU.
   Falls back silently to the CSS lamp wash if WebGL is absent.
   ========================================================= */

(function initGalaxy(restored) {
  "use strict";

  var canvas = document.getElementById("field");
  if (!canvas) return;

  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var calm = motion.matches;
  var listeners = [], buffers = [], shaders = [];
  function listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    listeners.push(function () { target.removeEventListener(name, handler, options); });
  }

  var gl;
  try { gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true, // blend output is premultiplied for soft page compositing
    powerPreference: "high-performance"
  }) || canvas.getContext("experimental-webgl");
  } catch (error) { canvas.style.display = "none"; return; }

  if (!gl) { canvas.style.display = "none"; return; }

  /* ---------- tunables ------------------------------------------- */
  var CFG = {
    count: 12000,
    mobileCount: 4200,
    radius: 13.5,
    thickness: 0.38,
    orbitSpeed: 0.018,
    tilt: 0.40,
    parallax: 0.025,
    maxDpr: 1.75,
    camZ: 9,
    fov: 52 * Math.PI / 180,
    pushRadius: 2.6,   // world units the cursor clears
    pushForce: 1.35,
    introMs: 4800
  };

  /* ---------- shaders -------------------------------------------- */

  var VERT = [
    "precision highp float;",
    "attribute vec3 aPos;",
    "attribute vec3 aSeed;",          // phase, speed, size
    "attribute vec2 aMaterial;",      // visual density and pigment only
    "uniform mat4 uProj;",
    "uniform mat4 uView;",
    "uniform float uTime;",
    "uniform float uIntro;",
    "uniform float uDpr;",
    "uniform float uOrbit;",
    "uniform float uTilt;",
    "uniform vec2 uParallax;",
    "uniform vec2  uCursor;",
    "uniform float uCursorOn;",
    "varying float vGlow;",
    "varying float vFade;",
    "varying vec2 vMaterial;",
    "varying float vTint;",

    "void main() {",
    // Analytic orbits: static GPU buffers, no per-particle CPU integration.
    "  float ph = aSeed.x * 6.2831853;",
    "  float radius = length(aPos.xz);",
    "  float age = clamp(uIntro * 1.16 - aSeed.y * 0.16, 0.0, 1.0);",
    "  float settle = smoothstep(0.16, 1.0, age);",
    "  float burst = 1.0 - pow(1.0 - min(age / 0.24, 1.0), 3.0);",
    "  float scale = mix(0.035, 1.0, burst) + 0.38 * sin(age * 3.14159265) * (1.0 - settle);",
    "  float angle = uTime * uOrbit / sqrt(0.8 + radius) + (1.0 - settle) * (1.1 + aSeed.y);",
    "  mat2 orbit = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));",
    "  vec3 p = aPos;",
    "  p.xz = orbit * p.xz * scale;",
    "  p.y = p.y * scale + sin(ph + age * 4.0) * radius * 0.35 * burst * (1.0 - settle);",
    "  p.x += sin(uTime * aSeed.y * 0.42 + ph) * 0.12 * settle;",
    "  p.y += cos(uTime * aSeed.y * 0.31 + ph * 1.7) * 0.10 * settle;",
    "  p.z += sin(uTime * aSeed.y * 0.24 + ph * 0.6) * 0.16 * settle;",
    // Tilt disk out of the image plane, then roll to retain the diagonal silhouette.
    "  float tilt = uTilt + uParallax.y;",
    "  p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;",
    "  float roll = 0.40 + uParallax.x;",
    "  p.xy = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * p.xy;",
    "  p += vec3(1.4, 0.2, -5.5);",
    "  float depth = clamp((p.z + 18.0) / 20.0, 0.0, 1.0);",
    // Project the cursor ray onto each grain's depth plane, including camera offset.
    "  vec2 cursor = uCursor * (9.0 - p.z) / 9.0 - uView[3].xy;",
    "  vec2 away = p.xy - cursor;",
    "  float d = length(away);",
    "  float push = (1.0 - smoothstep(0.0, PUSH_R, d)) * PUSH_F * depth * uCursorOn;",
    "  vec2 direction = normalize(away + vec2(0.0001));",
    "  p.xy += (direction + vec2(-direction.y, direction.x) * 0.18) * push;",
    "  p.z += push * 0.22 * sin(ph);",

    "  vec4 view = uView * vec4(p, 1.0);",
    "  gl_Position = uProj * view;",

    // size falls off with distance, like real depth of field
    "  float dist = -view.z;",
    // Keep every mark small and individually visible, including nearby grains.
    // This changes the sprite footprint only, never its trajectory.
    "  vMaterial = aMaterial;",
    "  vTint = aSeed.x;", // reuse a fixed seed for color; no new randomness or motion
    "  gl_PointSize = clamp(aSeed.z * (26.0 / max(dist, 0.4)) * 1.5, 1.4, 3.8) * uDpr;",

    // near the cursor the lamp catches them
    "  vGlow = (1.0 - smoothstep(0.4, 4.2, d)) * uCursorOn * depth;",
    // far particles sink into the dark
    "  vFade = (1.0 - smoothstep(5.0, 29.0, dist)) * mix(0.35, 1.0, depth) * smoothstep(0.0, 0.16, age);",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying float vGlow;",
    "varying float vFade;",
    "varying vec2 vMaterial;",
    "varying float vTint;",
    "uniform vec3 uDim;",
    "uniform vec3 uCool;",
    "uniform vec3 uLit;",
    "uniform vec3 uPigment;",
    "uniform float uOpacity;",
    "void main() {",
    "  vec2 c = gl_PointCoord - 0.5;",
    "  float r = length(c);",
    "  if (r > 0.5) discard;",
    "  float a = 1.0 - smoothstep(0.12, 0.5, r);",
    "  a = pow(a, 1.15);",
    // Most grains stay neutral; a quarter catch mineral blue. Warm pigment
    // appears on a few individual grains within the existing spatial pockets.
    "  float cool = 1.0 - smoothstep(0.20, 0.30, vTint);",
    "  float warm = smoothstep(0.86, 0.94, vTint) * smoothstep(0.60, 0.85, vMaterial.y);",
    "  vec3 resting = mix(uDim, uCool, cool);",
    "  resting = mix(resting, uPigment, warm);",
    "  vec3 col = mix(resting, mix(uLit, resting, 0.24), vGlow);",
    "  gl_FragColor = vec4(col, min(0.94, a * vFade * vMaterial.x * uOpacity));",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    shaders.push(s);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("field shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  VERT = VERT
    .replace(/PUSH_R/g, CFG.pushRadius.toFixed(2))
    .replace(/PUSH_F/g, CFG.pushForce.toFixed(2));

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { shaders.forEach(function (s) { gl.deleteShader(s); }); canvas.style.display = "none"; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl.deleteProgram(prog); shaders.forEach(function (s) { gl.deleteShader(s); }); canvas.style.display = "none"; return; }
  gl.useProgram(prog);

  /* ---------- geometry -------------------------------------------- */

  var n = CFG.count;
  var pos = new Float32Array(n * 3);
  var seed = new Float32Array(n * 3);

  // Stable seed makes reloads, themes, and responsive comparisons reproducible.
  var randomState = 73129;
  function random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; }
  function normal() { return Math.sqrt(-2 * Math.log(Math.max(random(), 0.00001))) * Math.cos(random() * Math.PI * 2); }
  for (var i = 0; i < n; i++) {
    var r = (0.12 + Math.pow(random(), 0.72) * 0.88) * CFG.radius;
    var halo = random() < 0.18;
    var theta = Math.floor(random() * 3) * Math.PI * 2 / 3 + Math.log(1 + r) * 1.65 + normal() * (halo ? 1.8 : 0.20);
    pos[i * 3] = Math.cos(theta) * r;
    pos[i * 3 + 1] = normal() * (CFG.thickness + r * 0.018) * (halo ? 2.8 : 1);
    pos[i * 3 + 2] = Math.sin(theta) * r;
    seed[i * 3] = random();
    seed[i * 3 + 1] = 0.18 + random() * 0.62;
    seed[i * 3 + 2] = 0.55 + Math.pow(random(), 3) * 2.6;
  }

  function attrib(name, data, size) {
    var buf = gl.createBuffer();
    buffers.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  attrib("aPos", pos, 3);
  attrib("aSeed", seed, 3);

  var material = new Float32Array(n * 2);
  for (var j = 0; j < n; j++) {
    var r = Math.hypot(pos[j * 3], pos[j * 3 + 2]);
    material[j * 2] = (0.38 + random() * 0.75) * (1 - 0.55 * Math.pow(r / CFG.radius, 3));
    material[j * 2 + 1] = 0.5 + 0.5 * Math.sin(r * 0.6);
  }
  attrib("aMaterial", material, 2);

  var U = {};
  ["uProj","uView","uTime","uIntro","uDpr","uCursor","uCursorOn","uDim","uCool","uLit","uPigment","uOpacity","uOrbit","uTilt","uParallax"]
    .forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  function updatePalette() {
    var style = getComputedStyle(document.documentElement);
    [["uDim", "--field-dim"], ["uCool", "--field-cool"], ["uLit", "--field-lit"], ["uPigment", "--field-pigment"]]
      .forEach(function (entry) {
        var rgb = style.getPropertyValue(entry[1]).trim().split(",").map(Number);
        gl.uniform3f(U[entry[0]], rgb[0], rgb[1], rgb[2]);
      });
    // Paper uses translucent pigment; dark mode retains additive light.
    var light = document.documentElement.getAttribute("data-theme") === "light";
    gl.uniform1f(U.uOpacity, light ? 0.76 : 1.0);
    gl.blendFuncSeparate(gl.SRC_ALPHA, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  updatePalette();
  listen(document, "themechange", function () {
    if (!lost) { updatePalette(); if (calm) draw(0, 1); }
  });

  /* ---------- matrices -------------------------------------------- */

  var proj = new Float32Array(16);
  var view = new Float32Array(16);

  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0]=f/aspect; out[1]=0; out[2]=0;  out[3]=0;
    out[4]=0; out[5]=f; out[6]=0;         out[7]=0;
    out[8]=0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
    out[12]=0; out[13]=0; out[14]=2*far*near*nf; out[15]=0;
  }
  function translation(out, x, y, z) {
    out[0]=1;out[1]=0;out[2]=0;out[3]=0;
    out[4]=0;out[5]=1;out[6]=0;out[7]=0;
    out[8]=0;out[9]=0;out[10]=1;out[11]=0;
    out[12]=x;out[13]=y;out[14]=z;out[15]=1;
  }

  var aspect = 1, halfH = 1, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CFG.maxDpr);
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    halfH = Math.tan(CFG.fov / 2) * CFG.camZ;
    n = w < 760 ? CFG.mobileCount : CFG.count;
    perspective(proj, CFG.fov, aspect, 0.1, 100);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uDpr, dpr);
  }
  resize();

  /* ---------- cursor ---------------------------------------------- */

  var cx = 0, cy = 0, tx = 0, ty = 0, on = 0, onTarget = 0;
  var px = 0, py = 0; // camera parallax

  function pointer(e) {
    if (calm || !e.isPrimary) return;
    var r = canvas.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width * 2 - 1;
    var ny = 1 - (e.clientY - r.top) / r.height * 2;
    tx = nx * halfH * aspect; ty = ny * halfH;
    onTarget = Math.abs(nx) <= 1 && Math.abs(ny) <= 1 ? 1 : 0;
  }
  function leave() { onTarget = 0; tx = 0; ty = 0; }
  listen(window, "pointermove", pointer, { passive: true });
  listen(window, "pointerdown", pointer, { passive: true });
  listen(window, "pointerup", function (e) { if (e.pointerType !== "mouse") leave(); }, { passive: true });
  listen(window, "pointercancel", leave);
  listen(document, "pointerleave", leave);
  listen(window, "blur", leave);
  listen(window, "scroll", leave, { passive: true });

  var raf = 0, last = 0, elapsed = restored ? CFG.introMs : 0;
  var visible = true, suspended = false, lost = false, disposed = false;
  function draw(time, intro) {
    if (lost || disposed) return;
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uOrbit, CFG.orbitSpeed);
    gl.uniform1f(U.uTilt, CFG.tilt);
    gl.uniform2f(U.uParallax, px * 0.12, py * 0.12);
    gl.uniform2f(U.uCursor, cx, cy);
    gl.uniform1f(U.uCursorOn, on);
    translation(view, px, py, -CFG.camZ);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  function sync() {
    stop();
    if (disposed || lost || suspended || document.hidden || !visible) return;
    if (calm) { draw(0, 1); return; }
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (disposed || lost || suspended || calm || document.hidden || !visible) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now; elapsed += dt * 1000;
    var follow = 1 - Math.exp(-5 * dt), damping = 1 - Math.exp(-3 * dt);
    cx += (tx - cx) * follow; cy += (ty - cy) * follow;
    on += (onTarget - on) * damping;
    px += (Math.max(-0.4, Math.min(0.4, -cx * CFG.parallax)) - px) * damping;
    py += (Math.max(-0.3, Math.min(0.3, -cy * CFG.parallax)) - py) * damping;
    draw(elapsed / 1000, Math.min(elapsed / CFG.introMs, 1));
    raf = requestAnimationFrame(frame);
  }
  function measure() { if (!lost && !disposed) { resize(); if (calm) draw(0, 1); } }
  listen(window, "resize", measure, { passive: true });
  var resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  var observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting; sync();
  }) : null;
  if (observer) observer.observe(canvas);
  listen(document, "visibilitychange", sync);
  listen(motion, "change", function () {
    calm = motion.matches; elapsed = Math.max(elapsed, CFG.introMs);
    cx = cy = tx = ty = px = py = on = onTarget = 0; sync();
  });
  function dispose() {
    stop(); disposed = true;
    listeners.forEach(function (remove) { remove(); });
    if (observer) observer.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    if (!lost) { buffers.forEach(function (b) { gl.deleteBuffer(b); }); shaders.forEach(function (s) { gl.deleteShader(s); }); gl.deleteProgram(prog); }
  }
  listen(window, "pagehide", function (e) { if (e.persisted) { suspended = true; stop(); } else dispose(); });
  listen(window, "pageshow", function () { suspended = false; sync(); });
  listen(canvas, "webglcontextlost", function (e) { e.preventDefault(); lost = true; stop(); });
  listen(canvas, "webglcontextrestored", function () {
    // Rebuild only the renderer, never reload the page or disturb navigation.
    dispose();
    initGalaxy(true);
  });
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
  sync();
})();
