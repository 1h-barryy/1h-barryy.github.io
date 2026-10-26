/* Select exactly one renderer; legacy comparison is loopback-only. */
(function () {
  "use strict";
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var legacy = local && new URLSearchParams(location.search).get("galaxy") === "legacy";
  var spatial = local && new URLSearchParams(location.search).get("galaxy") === "spatial";
  var script = document.createElement("script");
  script.src = "/assets/js/field-" + (legacy ? "legacy" : spatial ? "spatial" : "galaxy") + ".js?v=20261026-clusters";
  script.onerror = function () { var canvas = document.getElementById("field"); if (canvas) canvas.style.display = "none"; };
  document.head.appendChild(script);
})();
