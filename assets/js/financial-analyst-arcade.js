/* =========================================================
   Financial Analyst Arcade — Web Edition
   Scenario → ask → reply → call → reveal, against the Render API.
   The page never holds future bars until /api/predict returns them.
   ========================================================= */

(function () {
  "use strict";

  const API_BASE = "https://financial-analyst-arcade-backend.onrender.com";

  const SLOW_AFTER = 5000;          // Render's free tier sleeps; say so after 5s
  const WAKE_MESSAGE = "Waking up the analyst server — this can take up to a minute.";
  const DIRECTIONS = ["DOWN", "FLAT", "UP"];

  const $ = function (id) { return document.getElementById(id); };

  /* ---------- state -------------------------------------------------- */

  let scenario = null;              // { id, title, bars }
  let future = [];                  // revealed bars, only after predict
  let direction = null;
  let locked = false;
  let epoch = 0;                    // bumps per scenario so late replies are ignored
  let metricLabels = {};
  let hoverDay = null;
  let view = "line";                // line | candle
  const busy = { scenario: false, ask: false, lock: false };

  /* ---------- network ------------------------------------------------ */

  function ApiError(kind, status) {
    this.kind = kind;               // network | timeout | http | malformed
    this.status = status || 0;
  }

  async function request(path, options) {
    const opts = options || {};
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, opts.timeout || 75000);
    const slow = opts.onSlow ? setTimeout(opts.onSlow, SLOW_AFTER) : 0;
    let response;
    try {
      response = await fetch(API_BASE + path, {
        method: opts.body ? "POST" : "GET",
        headers: opts.body ? { "Content-Type": "application/json" } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal
      });
    } catch (err) {
      setServer("offline");
      throw new ApiError(err && err.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timeout);
      clearTimeout(slow);
    }
    setServer(response.status >= 500 ? "offline" : "online");
    if (!response.ok) throw new ApiError("http", response.status);
    try {
      return await response.json();
    } catch (err) {
      throw new ApiError("malformed");
    }
  }

  /* Plain-language messages. Server detail text is never shown. */
  function explain(err) {
    if (!(err instanceof ApiError)) return "Something went wrong in the page. Try again.";
    if (err.kind === "timeout") return "The analyst server didn't answer in time. It may still be waking up — try again.";
    if (err.kind === "network") return "Couldn't reach the analyst server. Check your connection and try again.";
    if (err.kind === "malformed") return "The server sent a response the game couldn't read. Try again.";
    if (err.status === 404) return "This scenario is no longer available on the server. Load a fresh one to keep playing.";
    if (err.status === 422) return "The server couldn't accept that request. Adjust it and try again.";
    if (err.status === 429) return "The analyst is getting a lot of questions right now. Wait a moment and try again.";
    return "The analyst server ran into a problem. Try again in a moment.";
  }

  const SERVER_TEXT = { connecting: "Connecting", waking: "Waking up", online: "Online", offline: "Unreachable" };
  function setServer(state) {
    $("server-dot").dataset.state = state;
    $("server-state").textContent = SERVER_TEXT[state];
  }
  function slowNotice(mine) { if (mine === epoch) setServer("waking"); }

  /* ---------- small helpers ---------------------------------------- */

  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function signed(v, digits) {
    const r = Number(v.toFixed(digits));   // sign what is shown, so 0.001 reads "0.00", not "+0.00"
    return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(digits);
  }

  /* Green up, red down, neutral flat. Always paired with a sign, arrow, or word. */
  const GLYPH = { UP: "▲", DOWN: "▼", FLAT: "▬" };
  function tone(node, dir) {
    node.classList.remove("is-up", "is-down", "is-flat");
    if (dir) node.classList.add(dir === "UP" ? "is-up" : dir === "DOWN" ? "is-down" : "is-flat");
  }
  function signDir(v, digits) {
    // what a value reads as once rounded, so "−0.00" never shows up red
    const r = Number(v.toFixed(digits));
    return r > 0 ? "UP" : r < 0 ? "DOWN" : "FLAT";
  }
  function sentence(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function humanize(key) {
    if (metricLabels[key]) return metricLabels[key];
    const words = String(key).replace(/[_-]+/g, " ").trim();
    if (/^rsi$/i.test(words)) return "RSI";
    return sentence(words);
  }

  function setStatus(id, text, isBusy) {
    const node = $(id);
    node.textContent = text || "";
    node.classList.toggle("is-busy", !!isBusy && !!text);
  }
  function showError(prefix, text, retry) {
    $(prefix + "-error-text").textContent = text;
    $(prefix + "-error").hidden = false;
    const btn = $(prefix + "-retry");
    if (!btn) return;
    btn.hidden = !retry;
    btn.textContent = retry ? retry.label : "";
    btn.onclick = retry ? retry.run : null;
  }
  function clearError(prefix) { $(prefix + "-error").hidden = true; }

  /* Bars must have a finite day and close; anything else is left out rather than drawn wrong. */
  function toBars(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (b) {
      if (!isObj(b)) return null;
      const bar = { day: num(b.day), open: num(b.open), high: num(b.high), low: num(b.low), close: num(b.close), volume: num(b.volume) || 0 };
      return bar.day === null || bar.close === null ? null : bar;
    }).filter(Boolean).sort(function (a, b) { return a.day - b.day; });
  }
  function hasOHLC(bars) {
    return bars.every(function (b) { return b.open !== null && b.high !== null && b.low !== null; });
  }

  /* ---------- controls ------------------------------------------------ */

  function sync() {
    const open = !!scenario && !locked;
    const asking = !open || busy.ask || busy.lock;
    document.querySelectorAll("[data-question]").forEach(function (b) { b.disabled = asking; });
    $("question").disabled = asking;
    $("ask").disabled = asking;
    $("ask").textContent = busy.ask ? "…" : "Send";
    $("question").placeholder = locked ? "The call is locked. Load the next scenario to keep asking." : "Ask the analyst…";

    const calling = !open || busy.lock;
    document.querySelectorAll("[data-dir]").forEach(function (b) {
      b.disabled = calling;
      b.setAttribute("aria-pressed", String(b.dataset.dir === direction));
    });
    $("confidence").disabled = calling;
    $("lock").disabled = calling;
    $("lock").textContent = busy.lock ? "Revealing…" : locked ? "Locked" : "Lock in";
    $("next").disabled = busy.scenario;

    const candlesOk = !!scenario && hasOHLC(scenario.bars.concat(future));
    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.view === view));
      b.disabled = !scenario || (b.dataset.view === "candle" && !candlesOk);
    });
  }

  /* ---------- 01 scenario --------------------------------------------- */

  function resetRound() {
    scenario = null; future = []; direction = null; locked = false; hoverDay = null;
    $("confidence").value = 50;
    $("confidence-out").textContent = "50%";
    $("question").value = "";
    updateCount();
    hint("");
    resetChat();
    $("reveal-sealed").hidden = false;
    $("reveal-body").hidden = true;
    $("verdict").hidden = true;
    $("indicators").hidden = true;
    $("indicators").replaceChildren();
    $("indicators-empty").hidden = false;
    $("quote").hidden = true;
    $("stat-sessions").textContent = "—";
    clearError("lock");
    setStatus("lock-status", "");
  }

  function renderQuote() {
    const bars = scenario.bars, last = bars[bars.length - 1], prev = bars[bars.length - 2];
    let hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) { hi = Math.max(hi, b.high !== null ? b.high : b.close); lo = Math.min(lo, b.low !== null ? b.low : b.close); });
    $("q-last").textContent = last.close.toFixed(2);
    const change = (last.close / prev.close - 1) * 100;
    $("q-change").textContent = signed(change, 2) + "%";
    tone($("q-change"), signDir(change, 2));
    $("q-high").textContent = hi.toFixed(2);
    $("q-low").textContent = lo.toFixed(2);
    $("quote").hidden = false;
    $("stat-sessions").textContent = bars.length + " visible";
  }

  async function loadScenario() {
    const mine = ++epoch;
    resetRound();
    clearError("scenario");
    $("chart-figure").hidden = true;
    $("scenario-id").textContent = "—";
    busy.scenario = true;
    setServer("connecting");
    setStatus("scenario-status", "Loading scenario…", true);
    sync();

    try {
      const data = await request("/api/scenario", {
        timeout: 90000,
        onSlow: function () { if (mine === epoch) { slowNotice(mine); setStatus("scenario-status", WAKE_MESSAGE, true); } }
      });
      if (mine !== epoch) return;
      const bars = isObj(data) ? toBars(data.chart) : [];
      const id = isObj(data) && typeof data.scenario_id === "string" ? data.scenario_id.trim() : "";
      if (!id || bars.length < 2) throw new ApiError("malformed");

      scenario = { id: id, title: typeof data.title === "string" ? data.title : "", bars: bars };
      if (view === "candle" && !hasOHLC(bars)) view = "line";
      $("scenario-id").textContent = scenario.id;
      $("scenario-id").title = scenario.title;
      renderQuote();
      setStatus("scenario-status", "");
      $("chart-figure").hidden = false;
      drawChart();
    } catch (err) {
      if (mine !== epoch) return;
      setStatus("scenario-status", "");
      showError("scenario", explain(err), null);
    } finally {
      if (mine === epoch) { busy.scenario = false; sync(); }
    }
  }
  $("scenario-retry").addEventListener("click", loadScenario);

  /* ---------- 03 analyst chat ------------------------------------------ */

  const log = $("chat-log");
  const intro = $("chat-intro");

  function resetChat() { log.replaceChildren(intro); }

  function scrollTo(node) {
    // keep the question and the start of the reply in view, not the bottom of a long reply
    log.scrollTop += node.getBoundingClientRect().top - log.getBoundingClientRect().top - 12;
  }

  function bubble(kind, label, mode) {
    const wrap = el("div", null, "faa-msg faa-msg--" + kind);
    const head = el("div", null, "faa-msg__head");
    head.append(el("span", label, "faa-who"));
    if (mode) head.append(mode);
    const body = el("div", null, "faa-msg__body");
    wrap.append(head, body);
    return { wrap: wrap, body: body };
  }

  function updateCount() { $("question-count").textContent = $("question").value.length + " / 600"; }
  function hint(text) { $("ask-hint").textContent = text || ""; }
  $("question").addEventListener("input", function () { updateCount(); hint(""); });

  async function ask(raw, retrying) {
    if (!scenario || locked || busy.ask) return;
    const question = String(raw || "").trim();
    hint("");
    if (!question) { hint("Type a question first, or pick one of the suggestions."); $("question").focus(); return; }
    if (question.length > 600) { hint("Keep the question under 600 characters."); return; }

    const mine = epoch;
    if (!retrying) {
      const user = el("div", null, "faa-msg faa-msg--user");
      user.append(el("span", "You", "faa-who"), el("p", question));
      log.append(user);
      $("question").value = "";
      updateCount();
    }
    const pending = bubble("pending", "Analyst");
    pending.body.textContent = "Analyzing…";
    log.append(pending.wrap);
    scrollTo(pending.wrap.previousElementSibling || pending.wrap);

    busy.ask = true;
    sync();

    try {
      const data = await request("/api/analyze", {
        body: { scenario_id: scenario.id, question: question },
        onSlow: function () {
          if (mine === epoch && busy.ask) { slowNotice(mine); pending.body.textContent = "Still analyzing — the server may be waking up. This can take up to a minute."; }
        }
      });
      if (mine !== epoch) return;
      const reply = renderReply(data);
      if (!reply) throw new ApiError("malformed");
      pending.wrap.replaceWith(reply);
    } catch (err) {
      if (mine !== epoch) return;
      const gone = err instanceof ApiError && err.status === 404;
      const fail = bubble("error", "Not delivered");
      fail.body.append(el("p", explain(err)));
      const retry = el("button", gone ? "Load a new scenario" : "Try again", "faa-btn");
      retry.type = "button";
      retry.addEventListener("click", function () {
        if (gone) { loadScenario(); return; }
        if (busy.ask || locked) return;
        fail.wrap.remove();
        ask(question, true);
      });
      fail.body.append(retry);
      pending.wrap.replaceWith(fail.wrap);
    } finally {
      if (mine === epoch) { busy.ask = false; sync(); if (!locked) $("question").focus({ preventScroll: true }); }
    }
  }

  $("ask-form").addEventListener("submit", function (e) { e.preventDefault(); ask($("question").value); });
  $("question").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask($("question").value); }
  });
  document.querySelectorAll("[data-question]").forEach(function (b) {
    b.addEventListener("click", function () { ask(b.dataset.question); });
  });

  /* Signals arrive as { metric, interpretation } today; strings and other
     shapes are still read rather than printed as raw syntax. */
  function items(value) {
    if (value == null) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map(function (it) {
      if (typeof it === "string") return it.trim() ? { text: sentence(it) } : null;
      if (typeof it === "number") return { text: String(it) };
      if (!isObj(it)) return null;
      const label = it.metric || it.name || it.signal || it.label || "";
      let text = it.interpretation || it.explanation || it.description || it.detail || it.text || it.summary || "";
      if (!text) {
        text = Object.keys(it).filter(function (k) { return typeof it[k] === "string" && it[k] !== label; })
          .map(function (k) { return it[k]; }).join(" ");
      }
      if (!text && !label) return null;
      return { label: label ? humanize(label) : "", text: text ? sentence(text) : "" };
    }).filter(Boolean);
  }

  function section(title, list, emptyText, kind) {
    const wrap = el("div", null, "faa-sec" + (kind ? " faa-sec--" + kind : ""));
    wrap.append(el("h3", title));
    if (!list.length) { wrap.append(el("p", emptyText, "faa-none")); return wrap; }
    if (kind === "summary" || (kind === "watch" && list.every(function (it) { return !it.label; }))) {
      list.forEach(function (it) { wrap.append(el("p", it.text)); });
      return wrap;
    }
    const ul = el("ul");
    list.forEach(function (it) {
      const li = el("li");
      if (it.label) li.append(el("b", it.label));
      li.append(document.createTextNode(it.text));
      ul.append(li);
    });
    wrap.append(ul);
    return wrap;
  }

  /* Only a reply that says it came from the AI is labelled as one. A reply
     that marks itself as fallback says so plainly; anything else stays neutral. */
  function replyMode(data) {
    const mode = String(data.analysis_mode || "").toLowerCase();
    if (mode === "fallback" || data.fallback === true) {
      return { label: "Offline analysis — AI unavailable", cls: "faa-mode faa-mode--offline" };
    }
    if (mode === "ai") return { label: "AI analysis", cls: "faa-mode" };
    return null;
  }

  function renderReply(data) {
    if (!isObj(data)) return null;
    const parts = {
      summary: items(data.summary),
      support: items(data.supporting_signals),
      risk: items(data.risk_signals),
      conflict: items(data.conflicting_signals),
      watch: items(data.watch_for)
    };
    const total = parts.summary.length + parts.support.length + parts.risk.length + parts.conflict.length + parts.watch.length;
    if (!total) return null;
    if (isObj(data.verified_metrics)) renderIndicators(data.verified_metrics);

    const m = replyMode(data);
    const reply = bubble("analyst", "Analyst", m ? el("span", m.label, m.cls) : null);
    reply.body.append(
      section("Summary", parts.summary, "No summary this time — the signals below carry the reply.", "summary"),
      section("Supporting", parts.support, "No supporting signals flagged."),
      section("Risks", parts.risk, "No risk signals flagged."),
      section("Conflicting", parts.conflict, "No conflicting signals flagged."),
      section("Watch for", parts.watch, "Nothing specific flagged to watch.", "watch")
    );
    return reply.wrap;
  }

  const DIRECTIONAL = /return|gap|change/i;

  function formatMetric(key, value, unit) {
    const v = num(value);
    if (v === null) return "—";
    if (unit === "%") return (DIRECTIONAL.test(key) ? signed(v, 2) : v.toFixed(2)) + "%";
    if (unit === "x") return v.toFixed(2) + "×";
    if (!unit) return v.toFixed(1);
    return v.toFixed(2);
  }

  function renderIndicators(vm) {
    const dl = $("indicators");
    const rows = [];
    Object.keys(vm).forEach(function (key) {
      const m = vm[key];
      if (!isObj(m)) return;
      const label = typeof m.label === "string" && m.label ? m.label : humanize(key);
      metricLabels[key] = label;
      const row = el("div");
      if (typeof m.description === "string") row.title = m.description;
      const unit = typeof m.unit === "string" ? m.unit : "";
      const dd = el("dd", formatMetric(key, m.value, unit));
      // only signed changes carry direction; levels like RSI, SMA or volatility stay neutral
      if (unit === "%" && DIRECTIONAL.test(key) && num(m.value) !== null) tone(dd, signDir(m.value, 2));
      row.append(el("dt", label), dd);
      rows.push(row);
    });
    if (!rows.length) return;
    dl.replaceChildren.apply(dl, rows);
    dl.hidden = false;
    $("indicators-empty").hidden = true;
  }

  /* ---------- 04 thesis ------------------------------------------------ */

  document.querySelectorAll("[data-dir]").forEach(function (b) {
    b.addEventListener("click", function () { direction = b.dataset.dir; clearError("lock"); sync(); });
  });
  $("confidence").addEventListener("input", function () { $("confidence-out").textContent = $("confidence").value + "%"; });

  async function lockIn() {
    if (!scenario || locked || busy.lock) return;
    clearError("lock");
    if (DIRECTIONS.indexOf(direction) < 0) { showError("lock", "Choose Down, Flat, or Up before locking in.", null); return; }
    const confidence = Number($("confidence").value);
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
      showError("lock", "Confidence must be a whole number from 0 to 100.", null); return;
    }

    const mine = epoch;
    busy.lock = true;
    setStatus("lock-status", "Revealing outcome…", true);
    sync();

    try {
      const data = await request("/api/predict", {
        body: { scenario_id: scenario.id, prediction: direction, confidence: confidence },
        onSlow: function () { if (mine === epoch && busy.lock) { slowNotice(mine); setStatus("lock-status", WAKE_MESSAGE, true); } }
      });
      if (mine !== epoch) return;
      const actual = isObj(data) && typeof data.actual_direction === "string" ? data.actual_direction.toUpperCase() : "";
      if (DIRECTIONS.indexOf(actual) < 0) throw new ApiError("malformed");

      locked = true;
      future = toBars(data.future_chart).filter(function (b) { return b.day > scenario.bars[scenario.bars.length - 1].day; });
      if (view === "candle" && !hasOHLC(scenario.bars.concat(future))) view = "line";
      const call = typeof data.prediction === "string" ? data.prediction.toUpperCase() : direction;
      const conf = num(data.confidence) !== null ? data.confidence : confidence;
      const correct = typeof data.directional_prediction_correct === "boolean" ? data.directional_prediction_correct : call === actual;
      const ret = num(data.actual_return);

      $("r-direction").textContent = GLYPH[actual] + " " + sentence(actual.toLowerCase());
      tone($("r-direction"), actual);
      $("r-return").textContent = ret === null ? "Not provided" : signed(ret, 2) + "%";
      tone($("r-return"), ret === null ? null : signDir(ret, 2));
      $("r-call").textContent = (GLYPH[call] ? GLYPH[call] + " " : "") + sentence(call.toLowerCase());
      tone($("r-call"), DIRECTIONS.indexOf(call) < 0 ? null : call);
      $("r-confidence").textContent = conf + "%";
      $("verdict").textContent = correct ? "✓ Correct" : "✗ Incorrect";
      $("verdict").classList.toggle("is-right", correct);
      $("verdict").classList.toggle("is-wrong", !correct);
      $("verdict").hidden = false;
      setStatus("lock-status", "");
      hint("");
      $("reveal-sealed").hidden = true;
      $("reveal-body").hidden = false;
      drawChart();
      $("reveal").focus({ preventScroll: true });
      $("reveal").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    } catch (err) {
      if (mine !== epoch) return;
      setStatus("lock-status", "");
      const gone = err instanceof ApiError && err.status === 404;
      showError("lock", explain(err), gone
        ? { label: "Load a new scenario", run: loadScenario }
        : { label: "Try again", run: lockIn });
    } finally {
      if (mine === epoch) { busy.lock = false; sync(); }
    }
  }
  $("lock").addEventListener("click", lockIn);

  /* ---------- 05 next -------------------------------------------------- */

  $("next").addEventListener("click", function () {
    loadScenario();
    const top = document.querySelector(".faa-desk");
    if (top) top.scrollIntoView({ block: "start" });
  });

  /* ---------- chart ---------------------------------------------------- */

  const canvas = $("chart");

  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.disabled) return;
      view = b.dataset.view;
      sync();
      drawChart();
    });
  });

  function palette() {
    const s = getComputedStyle(document.documentElement);
    const v = function (name) { return s.getPropertyValue(name).trim(); };
    return {
      accent: v("--accent"), ivory: v("--ivory"), dim: v("--ivory-dim"),
      hair: v("--hairline"), light: v("--light-rgb"), mono: v("--mono") || "monospace",
      up: v("--up-rgb"), down: v("--down-rgb")
    };
  }
  function rgb(triplet, a) { return "rgba(" + triplet + "," + a + ")"; }

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const past = scenario.bars, shown = past.concat(future);
    const lastPast = past[past.length - 1].day;
    const minDay = past[0].day;
    // before the reveal, hold a little room on the right for what is still locked
    const maxDay = future.length ? future[future.length - 1].day : lastPast + Math.max(4, Math.round(past.length * 0.1));
    const narrow = w < 480;
    const g = { w: w, h: h, left: 12, right: w - (narrow ? 44 : 54), top: 16 };
    g.volTop = h - 22 - Math.round(h * 0.16);
    g.bottom = g.volTop - 10;
    g.axis = h - 8;
    const span = maxDay - minDay + 1;
    g.step = (g.right - g.left) / span;
    g.x = function (day) { return g.left + (day - minDay + 0.5) * g.step; };
    let lo = Infinity, hi = -Infinity;
    shown.forEach(function (b) {
      hi = Math.max(hi, view === "candle" ? b.high : b.close);
      lo = Math.min(lo, view === "candle" ? b.low : b.close);
    });
    const pad = Math.max((hi - lo) * 0.1, 0.5);
    g.lo = lo - pad; g.hi = hi + pad;
    g.y = function (v) { return g.bottom - (v - g.lo) / (g.hi - g.lo) * (g.bottom - g.top); };
    g.cut = g.x(lastPast + 0.5);
    g.lastPast = lastPast; g.minDay = minDay; g.maxDay = maxDay;
    g.shown = shown;
    return g;
  }

  /* Green when the close is at or above the open, red below. Hollow vs filled
     bodies carry the same meaning without colour. Past bars sit slightly back
     so the revealed ones read as new. */
  function candle(ctx, g, b, c, revealed) {
    const x = Math.round(g.x(b.day)) + 0.5;
    const w = Math.max(1, Math.min(9, Math.floor(g.step * 0.62)));
    const up = b.close >= b.open;
    const color = rgb(up ? c.up : c.down, revealed ? 1 : 0.88);
    const top = Math.round(g.y(Math.max(b.open, b.close)));
    const bodyH = Math.max(1, Math.round(g.y(Math.min(b.open, b.close))) - top);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, Math.round(g.y(b.high))); ctx.lineTo(x, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, top + bodyH); ctx.lineTo(x, Math.round(g.y(b.low))); ctx.stroke();
    const left = Math.round(x - w / 2);
    // hollow body: close at or above open; filled body: close below open
    if (up && w > 2) ctx.strokeRect(left + 0.5, top + 0.5, w - 1, Math.max(1, bodyH - 1));
    else ctx.fillRect(left, top, w, bodyH);
  }

  function renderLegend() {
    const parts = view === "candle"
      ? [["faa-key-up", "▲ Close ≥ open"], ["faa-key-down", "▼ Close < open"]]
      : [["faa-key-line", "Close ▲ up / ▼ down vs prior"]];
    parts.push(["faa-key-vol", "Volume"]);
    if (future.length) parts.push(["faa-key-future", "Revealed"]);
    $("legend").replaceChildren.apply($("legend"), parts.map(function (p) {
      const s = el("span");
      s.append(el("i", null, p[0]), document.createTextNode(p[1]));
      return s;
    }));
  }

  function drawChart() {
    if (!scenario || $("chart-figure").hidden) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const c = palette(), g = layout();
    const past = scenario.bars;
    const rgba = function (a) { return "rgba(" + c.light + "," + a + ")"; };

    // price grid, labels on the right
    ctx.font = "10px " + c.mono;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const value = g.lo + (g.hi - g.lo) * i / 4, py = Math.round(g.y(value)) + 0.5;
      ctx.strokeStyle = c.hair;
      ctx.beginPath(); ctx.moveTo(g.left, py); ctx.lineTo(g.right, py); ctx.stroke();
      ctx.fillStyle = c.dim;
      ctx.fillText(value.toFixed(value >= 1000 ? 0 : 1), g.right + 8, py);
    }

    // what comes after the last visible session
    ctx.fillStyle = rgba(future.length ? 0.07 : 0.045);
    ctx.fillRect(g.cut, g.top - 6, g.right - g.cut, g.axis - 12 - g.top + 6);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = c.dim;
    ctx.beginPath(); ctx.moveTo(Math.round(g.cut) + 0.5, g.top - 6); ctx.lineTo(Math.round(g.cut) + 0.5, g.axis - 12); ctx.stroke();
    ctx.setLineDash([]);
    const zoneLabel = future.length ? "REVEALED" : "LOCKED";
    ctx.save();
    ctx.font = "9px " + c.mono;
    if (ctx.measureText(zoneLabel).width + 8 <= g.right - g.cut) {   // skip it rather than crowd a thin zone
      ctx.fillStyle = c.dim;
      ctx.textAlign = "center";
      ctx.fillText(zoneLabel, (g.cut + g.right) / 2, g.top + 2);
    }
    ctx.restore();

    if (view === "candle") {
      past.forEach(function (b) { candle(ctx, g, b, c, false); });
      future.forEach(function (b) { candle(ctx, g, b, c, true); });
    } else {
      // neutral area under the visible closes; direction lives in the line itself
      const grad = ctx.createLinearGradient(0, g.top, 0, g.bottom);
      grad.addColorStop(0, rgba(0.13)); grad.addColorStop(1, rgba(0));
      ctx.beginPath();
      past.forEach(function (b, i) { i ? ctx.lineTo(g.x(b.day), g.y(b.close)) : ctx.moveTo(g.x(b.day), g.y(b.close)); });
      ctx.lineTo(g.x(g.lastPast), g.bottom); ctx.lineTo(g.x(past[0].day), g.bottom); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      // each session's segment: green if it closed higher than the one before, red if lower
      const all = g.shown;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1], b = all[i], revealed = b.day > g.lastPast;
        ctx.beginPath();
        ctx.moveTo(g.x(a.day), g.y(a.close)); ctx.lineTo(g.x(b.day), g.y(b.close));
        ctx.lineWidth = revealed ? 2.4 : 1.6;
        ctx.strokeStyle = b.close === a.close ? c.dim : rgb(b.close > a.close ? c.up : c.down, revealed ? 1 : 0.9);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      future.forEach(function (b, i) {
        const prev = i ? future[i - 1] : past[past.length - 1];
        ctx.fillStyle = b.close === prev.close ? c.dim : rgb(b.close > prev.close ? c.up : c.down, 1);
        ctx.beginPath(); ctx.arc(g.x(b.day), g.y(b.close), 2.6, 0, Math.PI * 2); ctx.fill();
      });
    }

    // volume band, tinted by the session's close vs open
    const maxVol = Math.max.apply(null, g.shown.map(function (b) { return b.volume; }).concat([1]));
    const bw = Math.max(1.5, Math.min(7, g.step * 0.6));
    const volH = g.axis - 14 - g.volTop;
    g.shown.forEach(function (b) {
      const vh = b.volume / maxVol * volH;
      const up = b.open === null || b.close >= b.open;
      ctx.fillStyle = rgb(up ? c.up : c.down, b.day > g.lastPast ? 0.62 : 0.3);
      ctx.fillRect(g.x(b.day) - bw / 2, g.axis - 14 - vh, bw, vh);
    });

    // day axis
    ctx.fillStyle = c.dim;
    ctx.font = "9px " + c.mono;
    ctx.textBaseline = "alphabetic";
    const ticks = [g.minDay, Math.round((g.minDay + g.lastPast) / 2), g.lastPast];
    if (future.length) ticks.push(future[future.length - 1].day);
    ticks.forEach(function (d, i) {
      ctx.textAlign = i === 0 ? "left" : "center";
      ctx.fillText(d > 0 ? "+" + d : d < 0 ? "−" + Math.abs(d) : "0", i === 0 ? g.left : g.x(d), g.axis);
    });
    ctx.textAlign = "left";

    // hover
    const hb = g.shown.find(function (b) { return b.day === hoverDay; });
    if (hb) {
      const hx = Math.round(g.x(hb.day)) + 0.5;
      ctx.setLineDash([2, 3]); ctx.strokeStyle = c.dim;
      ctx.beginPath(); ctx.moveTo(hx, g.top); ctx.lineTo(hx, g.axis - 14); ctx.stroke(); ctx.setLineDash([]);
      if (view === "line") {
        const d = sessionDir(hb, g.shown);
        ctx.fillStyle = d === "FLAT" ? c.ivory : rgb(d === "UP" ? c.up : c.down, 1);
        ctx.beginPath(); ctx.arc(hx, g.y(hb.close), 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    canvas.setAttribute("aria-label", (view === "candle" ? "Candlestick chart (open, high, low, close)" : "Closing-price line") +
      " with volume for " + past.length + " sessions of a simulated market scenario" +
      (future.length ? ", plus " + future.length + " revealed sessions." : ". The next sessions stay locked until you lock in a prediction."));
    renderLegend();
    updateReadout(hb, g);
  }

  /* change from the previous close, the way the line segments are coloured */
  function sessionChange(bar, bars) {
    const i = bars.indexOf(bar);
    return i > 0 ? (bar.close / bars[i - 1].close - 1) * 100 : null;
  }
  function sessionDir(bar, bars) {
    const ch = sessionChange(bar, bars);
    return ch === null ? "FLAT" : signDir(ch, 2);
  }

  function updateReadout(bar, g) {
    const out = $("chart-readout");
    tone(out, null);
    if (bar) {
      const f = function (v) { return v === null ? "—" : v.toFixed(2); };
      const ch = sessionChange(bar, g.shown);
      const dir = ch === null ? null : signDir(ch, 2);
      out.textContent = (dir ? GLYPH[dir] + " " : "") + "D" + (bar.day > 0 ? "+" + bar.day : bar.day < 0 ? "−" + Math.abs(bar.day) : "0") +
        "  O " + f(bar.open) + "  H " + f(bar.high) + "  L " + f(bar.low) + "  C " + f(bar.close) +
        (ch === null ? "" : "  " + signed(ch, 2) + "%") + "  V " + Math.round(bar.volume).toLocaleString();
      tone(out, dir);
    } else if (hoverDay !== null && g && hoverDay > g.lastPast && !future.length) {
      out.textContent = "Next sessions locked until you lock in.";
    } else {
      out.textContent = "Hover the chart to inspect a session.";
    }
  }

  function pointAt(e) {
    if (!scenario) return;
    const g = layout();
    const px = e.clientX - canvas.getBoundingClientRect().left;
    if (px < g.left || px > g.right) { hoverDay = null; drawChart(); return; }
    hoverDay = Math.max(g.minDay, Math.min(g.maxDay, Math.round((px - g.left) / g.step - 0.5 + g.minDay)));
    drawChart();
  }
  canvas.addEventListener("pointermove", pointAt);
  canvas.addEventListener("pointerdown", pointAt);
  canvas.addEventListener("pointerleave", function () { hoverDay = null; drawChart(); });

  if ("ResizeObserver" in window) new ResizeObserver(function () { drawChart(); }).observe(canvas);
  else window.addEventListener("resize", drawChart, { passive: true });
  document.addEventListener("themechange", drawChart);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawChart);

  /* ---------- go ---------------------------------------------------- */

  sync();
  loadScenario();
})();
