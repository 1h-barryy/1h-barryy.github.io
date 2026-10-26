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
  // Local review only: hold the opened pose without chasing the pointer.
  var reviewOpen = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    && new URLSearchParams(location.search).get("reveal") === "open";
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
    revealTilt: 0.58,  // open the disk's inclination as Z roll exposes its face
    revealRoll: 0.18,
    revealPullback: 6.4,
    revealResponse: 1.6,
    revealStartMs: 4800,
    revealEndMs: 12800,
    parallax: 0.025,
    maxDpr: 1.75,
    camZ: 9,
    fov: 52 * Math.PI / 180,
    pushRadius: 2.6,   // world units the cursor clears
    pushForce: 1.35,
    goldStrength: 0.82,
    beaconRadius: 2.4,
    clusterCount: 192, // per destination, in the same buffers and draw call
    introMs: 4800
  };

  /* ---------- shaders -------------------------------------------- */

  var VERT = [
    "precision highp float;",
    "attribute vec3 aPos;",
    "attribute vec3 aSeed;",          // phase, speed, size
    "attribute vec2 aMaterial;",      // visual density and pigment only
    "attribute float aLayer;",        // 0 original spiral, 1 extended plane, 2 surrounding stars
    "uniform mat4 uProj;",
    "uniform mat4 uView;",
    "uniform float uTime;",
    "uniform float uIntro;",
    "uniform float uDpr;",
    "uniform float uOrbit;",
    "uniform float uTilt;",
    "uniform vec2 uParallax;",
    "uniform float uReveal;",
    "uniform float uRoll;",
    "uniform float uCamera;",
    "uniform vec2  uCursor;",
    "uniform float uCursorOn;",
    "uniform vec2 uBeacon;",
    "uniform float uBeaconOn;",
    "uniform float uBeaconRadius;",
    "uniform vec3 uNode0;",
    "uniform vec3 uNode1;",
    "uniform vec3 uNode2;",
    "varying float vGlow;",
    "varying float vFade;",
    "varying vec2 vMaterial;",
    "varying float vTint;",
    "varying float vGold;",

    "void main() {",
    // Analytic orbits: static GPU buffers, no per-particle CPU integration.
    "  float ph = aSeed.x * 6.2831853;",
    "  float radius = length(aPos.xz);",
    "  float age = clamp(uIntro * 1.16 - aSeed.y * 0.16, 0.0, 1.0);",
    "  float settle = smoothstep(0.16, 1.0, age);",
    "  float burst = 1.0 - pow(1.0 - min(age / 0.24, 1.0), 3.0);",
    "  float scale = mix(0.035, 1.0, burst) + 0.38 * sin(age * 3.14159265) * (1.0 - settle);",
    "  float node = step(2.5, aLayer);",
    "  float field = step(1.5, aLayer) * (1.0 - node);",
    "  float angle = uTime * uOrbit / sqrt(0.8 + radius) + (1.0 - settle) * (1.1 + aSeed.y);",
    "  angle *= mix(1.0, 0.12, field);",
    "  mat2 orbit = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));",
    "  vec3 p = aPos;",
    "  p.xz = orbit * p.xz * scale;",
    "  p.y = p.y * scale + sin(ph + age * 4.0) * radius * 0.35 * burst * (1.0 - settle);",
    "  p.x += sin(uTime * aSeed.y * 0.42 + ph) * 0.12 * settle;",
    "  p.y += cos(uTime * aSeed.y * 0.31 + ph * 1.7) * 0.10 * settle;",
    "  p.z += sin(uTime * aSeed.y * 0.24 + ph * 0.6) * 0.16 * settle;",
    // Local grains condense around a navigable center, then share the galaxy's
    // model transform, depth, camera and fragment shader. No sprite overlay.
    "  if (node > 0.5) {",
    "    vec3 center = aLayer < 3.5 ? uNode0 : (aLayer < 4.5 ? uNode1 : uNode2);",
    "    float turn = uTime * 0.025;",
    "    p = aPos;",
    "    p.xz = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * p.xz;",
    "    p += vec3(sin(uTime * 0.21 + ph), cos(uTime * 0.17 + ph), sin(uTime * 0.13 + ph)) * 0.035;",
    "    p = center + p * mix(0.24, 1.0, settle);",
    "  }",
    // Tilt disk out of the image plane, then roll to retain the diagonal silhouette.
    "  float tilt = (uTilt + uParallax.y) * mix(1.0, 0.18, field);",
    "  p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;",
    "  float roll = (0.40 + uParallax.x + uRoll) * mix(1.0, 0.25, field);",
    "  p.xy = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * p.xy;",
    "  p += vec3(1.4, 0.2, -5.5);",
    "  float depth = clamp((p.z + 18.0) / 20.0, 0.0, 1.0);",
    // Project the cursor ray onto each grain's depth plane, including camera offset.
    "  vec2 cursor = uCursor * (uCamera - p.z) / 9.0 - uView[3].xy;",
    "  vec2 away = p.xy - cursor;",
    "  float d = length(away);",
    "  float push = (1.0 - smoothstep(0.0, PUSH_R, d)) * PUSH_F * depth * uCursorOn;",
    "  push *= mix(1.0, 0.16, node);",
    "  vec2 direction = normalize(away + vec2(0.0001));",
    "  p.xy += (direction + vec2(-direction.y, direction.x) * 0.18) * push;",
    "  p.z += push * 0.22 * sin(ph);",
    // A celestial link illuminates its local depth slice. No new renderer.
    "  vec2 beacon = uBeacon * (uCamera - p.z) / 9.0 - uView[3].xy;",
    "  float beaconLight = (1.0 - smoothstep(0.0, uBeaconRadius, length(p.xy - beacon))) * uBeaconOn;",
    "  p.xy += vec2(-direction.y, direction.x) * beaconLight * 0.10;",

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
    "  vGlow = max(vGlow, beaconLight * 0.75);",
    // Warm pockets follow the original 3D distribution, not a screen wash.
    "  float dust = exp(-dot(aPos.xz - vec2(6.0, 3.0), aPos.xz - vec2(6.0, 3.0)) / 19.0);",
    "  dust += 0.8 * exp(-dot(aPos.xz - vec2(-6.0, -5.0), aPos.xz - vec2(-6.0, -5.0)) / 15.0);",
    "  vGold = clamp(dust * smoothstep(0.22, 0.72, aSeed.x) + beaconLight * 0.65, 0.0, 1.0);",
    "  if (node > 0.5) vGold = mix(aLayer < 3.5 ? 0.65 : (aLayer < 4.5 ? 0.12 : 0.32), 0.85, beaconLight * 0.5);",
    // far particles sink into the dark
    "  float fog = 1.0 - smoothstep(5.0, mix(29.0, 55.0, field), dist);",
    "  vFade = fog * mix(0.35, 1.0, depth) * smoothstep(0.0, 0.16, age);",
    // Original spiral keeps its material. Additional planes emerge gradually;
    // their fixed 3D positions and different rotation rates create separation.
    "  vFade *= mix(1.0, mix(0.025, 1.0, smoothstep(0.08, 0.85, uReveal)), step(0.5, aLayer) * (1.0 - node));",
    "  vFade *= 1.0 + uReveal * 0.32 * (1.0 - field);",
    "  vFade *= mix(1.0, 1.2 + beaconLight * 0.65, node);",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying float vGlow;",
    "varying float vFade;",
    "varying vec2 vMaterial;",
    "varying float vTint;",
    "varying float vGold;",
    "uniform vec3 uDim;",
    "uniform vec3 uCool;",
    "uniform vec3 uLit;",
    "uniform vec3 uPigment;",
    "uniform float uOpacity;",
    "uniform vec3 uGold;",
    "uniform float uGoldStrength;",
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
    "  resting = mix(resting, uGold, vGold * uGoldStrength);",
    "  vec3 col = mix(resting, mix(uLit, resting, 0.24), vGlow);",
    "  gl_FragColor = vec4(col, min(0.94, a * vFade * vMaterial.x * uOpacity * (1.0 + vGold * 0.45)));",
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

  var material = new Float32Array(n * 2);
  for (var j = 0; j < n; j++) {
    var r = Math.hypot(pos[j * 3], pos[j * 3 + 2]);
    material[j * 2] = (0.38 + random() * 0.75) * (1 - 0.55 * Math.pow(r / CFG.radius, 3));
    material[j * 2 + 1] = 0.5 + 0.5 * Math.sin(r * 0.6);
  }
  // Preserve every original position/seed/material. Interleave one extra grain
  // per three originals so mobile draws retain all three spatial populations.
  var clusterTotal = CFG.clusterCount * 3;
  var total = n + Math.floor(n / 3) + clusterTotal;
  var layeredPos = new Float32Array(total * 3);
  var layeredSeed = new Float32Array(total * 3);
  var layeredMaterial = new Float32Array(total * 2);
  var layers = new Float32Array(total);
  var k = clusterTotal;
  for (var original = 0; original < n; original++) {
    layeredPos.set(pos.subarray(original * 3, original * 3 + 3), k * 3);
    layeredSeed.set(seed.subarray(original * 3, original * 3 + 3), k * 3);
    layeredMaterial.set(material.subarray(original * 2, original * 2 + 2), k * 2);
    k++;
    if (original % 3 !== 2) continue;
    var background = original % 6 === 5;
    var radius = 4 + Math.sqrt(random()) * 13;
    var angle = random() * Math.PI * 2;
    layeredPos[k * 3] = background ? (random() * 2 - 1) * 27 : Math.cos(angle) * radius;
    layeredPos[k * 3 + 1] = background ? (random() * 2 - 1) * 17 : normal() * 0.75 + Math.sin(angle * 2 + radius * 0.3) * 0.55;
    layeredPos[k * 3 + 2] = background ? -8 - random() * 23 : Math.sin(angle) * radius;
    layeredSeed[k * 3] = random();
    layeredSeed[k * 3 + 1] = 0.18 + random() * 0.62;
    layeredSeed[k * 3 + 2] = 0.55 + Math.pow(random(), 3) * 2.6;
    layeredMaterial[k * 2] = background ? 1.4 + random() : 0.35 + random() * 0.65;
    layeredMaterial[k * 2 + 1] = random();
    layers[k] = background ? 2 : 1;
    k++;
  }
  // Leading grains ensure all three destinations remain present in mobile's
  // shorter draw range. Original galaxy data and random sequence are unchanged.
  for (var cluster = 0; cluster < 3; cluster++) {
    for (var grain = 0; grain < CFG.clusterCount; grain++) {
      var index = cluster * CFG.clusterCount + grain;
      var diffuse = random() < 0.32;
      var extent = diffuse ? 2.8 : 1;
      var t = normal();
      layeredPos[index * 3] = (cluster === 1 ? t * 0.36 : normal() * 0.21) * extent;
      layeredPos[index * 3 + 1] = (cluster === 1 ? Math.sin(t * 3) * 0.12 + normal() * 0.06 : normal() * 0.12) * extent;
      layeredPos[index * 3 + 2] = normal() * 0.24 * extent;
      if (cluster === 2) layeredPos[index * 3] += grain % 2 ? 0.25 : -0.25;
      layeredSeed[index * 3] = random();
      layeredSeed[index * 3 + 1] = 0.18 + random() * 0.62;
      layeredSeed[index * 3 + 2] = 0.50 + Math.pow(random(), 4) * 1.7;
      layeredMaterial[index * 2] = diffuse ? 0.6 : 1.05;
      layeredMaterial[index * 2 + 1] = random();
      layers[index] = cluster + 3;
    }
  }
  attrib("aPos", layeredPos, 3);
  attrib("aSeed", layeredSeed, 3);
  attrib("aMaterial", layeredMaterial, 2);
  attrib("aLayer", layers, 1);

  var U = {};
  ["uProj","uView","uTime","uIntro","uDpr","uCursor","uCursorOn","uDim","uCool","uLit","uPigment","uOpacity","uOrbit","uTilt","uParallax","uReveal","uRoll","uCamera","uGold","uGoldStrength","uBeacon","uBeaconOn","uBeaconRadius","uNode0","uNode1","uNode2"]
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
    gl.uniform3f(U.uGold, light ? 0.52 : 0.96, light ? 0.34 : 0.72, light ? 0.12 : 0.36);
    gl.uniform1f(U.uGoldStrength, CFG.goldStrength);
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
  var viewportWidth = 1, viewportHeight = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CFG.maxDpr);
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    viewportWidth = w; viewportHeight = h;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    halfH = Math.tan(CFG.fov / 2) * CFG.camZ;
    n = w < 760 ? CFG.mobileCount : CFG.count;
    n += Math.floor(n / 3);
    n += clusterTotal;
    perspective(proj, CFG.fov, aspect, 0.1, 100);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uDpr, dpr);
  }
  resize();

  /* ---------- cursor ---------------------------------------------- */

  var cx = 0, cy = 0, tx = 0, ty = 0, on = 0, onTarget = 0;
  var px = 0, py = 0; // camera parallax
  var reveal = 0, revealTarget = 0, roll = 0, rollTarget = 0;
  var anchors = Array.prototype.slice.call(document.querySelectorAll(".celestial"));
  var cosmos = document.querySelector(".cosmos");
  var nodeBases = [], nodeHomes = [], nodeScreens = [];
  var selectedAnchor = null;
  var beaconX = 0, beaconY = 0, beaconOn = 0;
  function unrotate(x, y, z, tilt, roll) {
    x -= 1.4; y -= 0.2; z += 5.5;
    var rx = x * Math.cos(roll) + y * Math.sin(roll);
    var ry = -x * Math.sin(roll) + y * Math.cos(roll);
    return [rx, ry * Math.cos(tilt) + z * Math.sin(tilt), -ry * Math.sin(tilt) + z * Math.cos(tilt)];
  }
  function screenToNode(x, y, z, camera, tilt, roll) {
    var half = Math.tan(CFG.fov / 2) * (camera - z);
    return unrotate((x / viewportWidth * 2 - 1) * half * aspect - px,
      (1 - y / viewportHeight * 2) * half - py, z, tilt, roll);
  }
  function measureNodes() {
    var bounds = canvas.getBoundingClientRect();
    anchors.forEach(function (anchor, i) {
      anchor.style.setProperty("--cosmos-x", "0px");
      anchor.style.setProperty("--cosmos-y", "0px");
      var body = anchor.querySelector(".celestial__body").getBoundingClientRect();
      var home = [body.left + body.width / 2 - bounds.left, body.top + body.height / 2 - bounds.top];
      nodeHomes[i] = home; nodeScreens[i] = home.slice();
      nodeBases[i] = screenToNode(home[0], home[1], -4 - i * 1.5, CFG.camZ, CFG.tilt, 0.40);
    });
  }
  function projectNodes(tilt, roll, camera) {
    anchors.forEach(function (anchor, i) {
      var p = nodeBases[i];
      var y = p[1] * Math.cos(tilt) - p[2] * Math.sin(tilt);
      var z = p[1] * Math.sin(tilt) + p[2] * Math.cos(tilt) - 5.5;
      var x = p[0] * Math.cos(roll) - y * Math.sin(roll) + 1.4;
      y = p[0] * Math.sin(roll) + y * Math.cos(roll) + 0.2;
      var half = Math.tan(CFG.fov / 2) * (camera - z);
      var sx = ((x + px) / (half * aspect) + 1) * viewportWidth / 2;
      var sy = (1 - (y + py) / half) * viewportHeight / 2;
      // Compact layouts keep navigation in the clear lower constellation area.
      // While selected, pin the projected center to avoid a moving click target.
      if (viewportWidth <= 980 || selectedAnchor) {
        var point = selectedAnchor ? nodeScreens[i] : nodeHomes[i];
        sx = point[0]; sy = point[1];
        p = screenToNode(sx, sy, z, camera, tilt, roll);
      }
      nodeScreens[i] = [sx, sy];
      gl.uniform3f(U["uNode" + i], p[0], p[1], p[2]);
      anchor.style.setProperty("--cosmos-x", (sx - nodeHomes[i][0]) + "px");
      anchor.style.setProperty("--cosmos-y", (sy - nodeHomes[i][1]) + "px");
    });
  }
  measureNodes();
  function selectAnchor() {
    selectedAnchor = document.querySelector(".celestial.is-active");
    if (selectedAnchor) {
      var body = selectedAnchor.querySelector(".celestial__body").getBoundingClientRect();
      var bounds = canvas.getBoundingClientRect();
      beaconX = ((body.left + body.width / 2 - bounds.left) / bounds.width * 2 - 1) * halfH * aspect;
      beaconY = (1 - (body.top + body.height / 2 - bounds.top) / bounds.height * 2) * halfH;
    }
    if (calm) { beaconOn = selectedAnchor ? 1 : 0; draw(0, 1); }
  }
  listen(document, "cosmoschange", selectAnchor);

  function pointer(e) {
    if (calm || !e.isPrimary) return;
    var r = canvas.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width * 2 - 1;
    var ny = 1 - (e.clientY - r.top) / r.height * 2;
    tx = nx * halfH * aspect; ty = ny * halfH;
    onTarget = Math.abs(nx) <= 1 && Math.abs(ny) <= 1 ? 1 : 0;
    var edge = Math.max(0, Math.min(1, (Math.abs(nx) - 0.18) / 0.62));
    revealTarget = edge * edge * (3 - 2 * edge) * onTarget;
    rollTarget = (nx < 0 ? -1 : 1) * revealTarget;
  }
  function leave() { onTarget = 0; tx = 0; ty = 0; revealTarget = rollTarget = 0; }
  listen(window, "pointermove", pointer, { passive: true });
  listen(window, "pointerdown", pointer, { passive: true });
  listen(window, "pointerup", function (e) { if (e.pointerType !== "mouse") leave(); }, { passive: true });
  listen(window, "pointercancel", leave);
  listen(document, "pointerleave", leave);
  listen(window, "blur", leave);
  listen(window, "scroll", leave, { passive: true });

  var raf = 0, last = 0, elapsed = restored ? CFG.revealEndMs : 0;
  var visible = true, suspended = false, lost = false, disposed = false;
  function draw(time, intro) {
    if (lost || disposed) return;
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uOrbit, CFG.orbitSpeed);
    var opening = reviewOpen ? 1 : calm ? 0.65 : reveal;
    var camera = CFG.camZ + opening * CFG.revealPullback;
    gl.uniform1f(U.uTilt, CFG.tilt + opening * CFG.revealTilt);
    gl.uniform1f(U.uReveal, opening);
    gl.uniform1f(U.uRoll, reviewOpen ? CFG.revealRoll : calm ? 0.08 : roll * CFG.revealRoll);
    gl.uniform1f(U.uCamera, camera);
    gl.uniform2f(U.uParallax, px * 0.12, py * 0.12);
    gl.uniform2f(U.uCursor, cx, cy);
    gl.uniform1f(U.uCursorOn, on);
    gl.uniform2f(U.uBeacon, beaconX, beaconY);
    gl.uniform1f(U.uBeaconOn, beaconOn);
    gl.uniform1f(U.uBeaconRadius, CFG.beaconRadius);
    projectNodes(CFG.tilt + opening * CFG.revealTilt + py * 0.12,
      0.40 + px * 0.12 + (reviewOpen ? CFG.revealRoll : calm ? 0.08 : roll * CFG.revealRoll), camera);
    translation(view, px, py, -camera);
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
    beaconOn += ((selectedAnchor ? 1 : 0) - beaconOn) * follow;
    px += (Math.max(-0.4, Math.min(0.4, -cx * CFG.parallax)) - px) * damping;
    py += (Math.max(-0.3, Math.min(0.3, -cy * CFG.parallax)) - py) * damping;
    // One discovery beat after formation, then pointer-driven reopening.
    // Quintic envelopes stop gently at both ends without repeated idle tilting.
    function ease(value) { var x = Math.max(0, Math.min(1, value)); return x*x*x*(x*(x*6-15)+10); }
    var opening = ease((elapsed - CFG.revealStartMs) / 2600);
    var closing = 1 - ease((elapsed - (CFG.revealEndMs - 3200)) / 3200);
    var automatic = opening * closing;
    var response = 1 - Math.exp(-CFG.revealResponse * dt);
    reveal += (Math.max(automatic, revealTarget) - reveal) * response;
    roll += ((revealTarget > automatic ? rollTarget : automatic) - roll) * response;
    draw(elapsed / 1000, Math.min(elapsed / CFG.introMs, 1));
    raf = requestAnimationFrame(frame);
  }
  function measure() { if (!lost && !disposed) { resize(); measureNodes(); selectAnchor(); if (calm) draw(0, 1); } }
  listen(window, "resize", measure, { passive: true });
  var resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  var observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting; sync();
  }) : null;
  if (observer) observer.observe(canvas);
  listen(document, "visibilitychange", sync);
  listen(motion, "change", function () {
    calm = motion.matches; elapsed = Math.max(elapsed, CFG.revealEndMs);
    reveal = motion.matches ? 0.65 : reveal; revealTarget = rollTarget = roll = 0;
    cx = cy = tx = ty = px = py = on = onTarget = 0; sync();
  });
  function dispose() {
    stop(); disposed = true;
    listeners.forEach(function (remove) { remove(); });
    if (observer) observer.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    if (cosmos) cosmos.classList.remove("cosmos--particles");
    if (!lost) { buffers.forEach(function (b) { gl.deleteBuffer(b); }); shaders.forEach(function (s) { gl.deleteShader(s); }); gl.deleteProgram(prog); }
  }
  listen(window, "pagehide", function (e) { if (e.persisted) { suspended = true; stop(); } else dispose(); });
  listen(window, "pageshow", function () { suspended = false; sync(); });
  listen(canvas, "webglcontextlost", function (e) { e.preventDefault(); lost = true; stop(); if (cosmos) cosmos.classList.remove("cosmos--particles"); });
  listen(canvas, "webglcontextrestored", function () {
    // Rebuild only the renderer, never reload the page or disturb navigation.
    dispose();
    initGalaxy(true);
  });
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
  if (cosmos) cosmos.classList.add("cosmos--particles");
  selectAnchor();
  sync();
})();
