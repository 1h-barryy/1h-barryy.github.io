/* =========================================================
   Ambient particle field — raw WebGL, no dependencies.
   Drift, depth fog and cursor repulsion all run on the GPU.
   Falls back silently to the CSS lamp wash if WebGL is absent.
   ========================================================= */

(function () {
  "use strict";

  var canvas = document.getElementById("field");
  if (!canvas) return;

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true, // blend output is premultiplied for soft page compositing
    powerPreference: "high-performance"
  }) || canvas.getContext("experimental-webgl");

  if (!gl) { canvas.style.display = "none"; return; }

  /* ---------- tunables ------------------------------------------- */
  var CFG = {
    count: window.innerWidth < 760 ? 4200 : 12000,
    spreadX: 17,
    spreadY: 10,
    nearZ: 2.5,
    farZ: -16,
    camZ: 9,
    fov: 52 * Math.PI / 180,
    pushRadius: 2.6,   // world units the cursor clears
    pushForce: 1.35,
    introMs: 2600
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
    "uniform vec2  uCursor;",
    "uniform float uCursorOn;",
    "varying float vGlow;",
    "varying float vFade;",
    "varying vec2 vMaterial;",
    "varying float vTint;",

    "void main() {",
    "  vec3 p = aPos;",
    "  float ph = aSeed.x * 6.2831853;",
    "  float sp = aSeed.y;",

    // slow ambient drift — three decorrelated sines so it never loops visibly
    "  p.x += sin(uTime * sp * 0.42 + ph) * 0.55;",
    "  p.y += cos(uTime * sp * 0.31 + ph * 1.7) * 0.42;",
    "  p.z += sin(uTime * sp * 0.24 + ph * 0.6) * 0.60;",

    // entrance: everything unfolds outward from a small dense core
    "  vec3 core = normalize(aPos + vec3(0.0001)) * 0.85;",
    "  p = mix(core, p, uIntro);",

    // cursor clears a soft pocket; nearer particles react more
    "  float depth = clamp((p.z + 16.0) / 19.0, 0.0, 1.0);",
    "  vec2 away = p.xy - uCursor;",
    "  float d = length(away);",
    "  float push = smoothstep(PUSH_R, 0.0, d) * PUSH_F * depth * uCursorOn;",
    "  p.xy += normalize(away + vec2(0.0001)) * push;",

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
    "  vGlow = smoothstep(4.2, 0.4, d) * uCursorOn * depth;",
    // far particles sink into the dark
    "  vFade = smoothstep(19.0, 3.0, dist) * mix(0.25, 1.0, depth) * uIntro;",
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
  if (!vs || !fs) { canvas.style.display = "none"; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = "none"; return; }
  gl.useProgram(prog);

  /* ---------- geometry -------------------------------------------- */

  var n = CFG.count;
  var pos = new Float32Array(n * 3);
  var seed = new Float32Array(n * 3);

  for (var i = 0; i < n; i++) {
    // bias toward the middle so the edges thin out naturally
    var bx = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
    var by = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
    var z = CFG.farZ + Math.pow(Math.random(), 0.75) * (CFG.nearZ - CFG.farZ);

    pos[i * 3]     = bx * CFG.spreadX;
    pos[i * 3 + 1] = by * CFG.spreadY;
    pos[i * 3 + 2] = z;

    seed[i * 3]     = Math.random();                       // phase
    seed[i * 3 + 1] = 0.18 + Math.random() * 0.62;          // speed
    seed[i * 3 + 2] = 0.55 + Math.pow(Math.random(), 3) * 2.6; // size
  }

  function attrib(name, data, size) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  attrib("aPos", pos, 3);
  attrib("aSeed", seed, 3);

  /* ---------- material composition (no position or seed mutations) -- */
  // A density mask brings out fine, interwoven strands of individual grains
  // and lets the surrounding field recede. The original geometry, random
  // sequence, drift, repulsion and camera remain untouched.
  var material = new Float32Array(n * 2);
  for (var j = 0; j < n; j++) {
    var distance = CFG.camZ - pos[j * 3 + 2];
    var x = pos[j * 3] / distance;
    var y = pos[j * 3 + 1] / distance;
    var spine = x * 0.46 - 0.06 + Math.sin(x * 9 + 0.7) * 0.06 + Math.sin(x * 20) * 0.018;
    var width = 0.065 + (0.5 + 0.5 * Math.sin(x * 4.1 - 0.5)) * 0.035;
    var band = Math.exp(-Math.pow((y - spine) / width, 2));
    var strand = Math.exp(-Math.pow((y - spine + Math.sin(x * 17) * 0.023) / 0.025, 2));
    var thread = Math.exp(-Math.pow((y - spine - 0.06 - Math.sin(x * 12 + 1.2) * 0.036) / 0.022, 2));
    var knots = 0.78 + 0.22 * Math.sin(x * 15 + y * 9) * Math.cos(y * 21 - x * 6);
    // Lift the small middle-distance grains without adding a blurred layer.
    var grainLight = 1 + Math.max(0, distance - 8) * 0.16;
    material[j * 2] = 0.035 + (band * 1.0 + strand * 4.0 + thread * 2.6) * knots * grainLight;
    material[j * 2 + 1] = 0.5 + 0.5 * Math.sin(x * 7 + y * 11);
  }
  attrib("aMaterial", material, 2);

  var U = {};
  ["uProj","uView","uTime","uIntro","uDpr","uCursor","uCursorOn","uDim","uCool","uLit","uPigment","uOpacity"]
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
  document.addEventListener("themechange", function () {
    updatePalette();
    if (calm) draw(0, 1);
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
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    halfH = Math.tan(CFG.fov / 2) * CFG.camZ;
    perspective(proj, CFG.fov, aspect, 0.1, 100);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uDpr, dpr);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  /* ---------- cursor ---------------------------------------------- */

  var cx = 0, cy = 0, tx = 0, ty = 0, on = 0, onTarget = 0;
  var px = 0, py = 0; // camera parallax

  window.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    var ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    tx = nx * halfH * aspect;
    ty = ny * halfH;
    onTarget = (e.clientY - r.top > 0 && e.clientY - r.top < r.height) ? 1 : 0;
  }, { passive: true });

  window.addEventListener("pointerdown", function () { onTarget = 1; }, { passive: true });
  document.addEventListener("pointerleave", function () { onTarget = 0; });

  /* ---------- loop ------------------------------------------------- */

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Blend factors are palette-dependent and set by updatePalette().

  var t0 = performance.now();
  var running = true;

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) { t0 = performance.now() - elapsed; requestAnimationFrame(frame); }
  });

  var elapsed = 0;

  function draw(time, intro) {
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform2f(U.uCursor, cx, cy);
    gl.uniform1f(U.uCursorOn, on);
    translation(view, px, py, -CFG.camZ);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);
  }

  if (calm) {
    // one still frame — the field becomes a texture, not an animation
    draw(0, 1);
    window.addEventListener("resize", function () { resize(); draw(0, 1); }, { passive: true });
    return;
  }

  function frame(now) {
    if (!running) return;
    elapsed = now - t0;
    var t = elapsed / 1000;

    var intro = Math.min(elapsed / CFG.introMs, 1);
    intro = 1 - Math.pow(1 - intro, 3);   // ease out cubic

    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    on += (onTarget - on) * 0.05;
    px += ((cx * -0.035) - px) * 0.04;
    py += ((cy * -0.035) - py) * 0.04;

    draw(t, intro);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; });
  canvas.addEventListener("webglcontextrestored", function () { location.reload(); });
})();
