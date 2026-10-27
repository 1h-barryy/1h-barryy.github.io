/* Select exactly one renderer; legacy comparison is loopback-only. */
(function () {
  "use strict";
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var legacy = local && new URLSearchParams(location.search).get("galaxy") === "legacy";
  var spatial = local && new URLSearchParams(location.search).get("galaxy") === "spatial";
  var approved = local && new URLSearchParams(location.search).get("intro") === "approved";
  var script = document.createElement("script");
  script.src = "/assets/js/field-" + (legacy ? "legacy" : spatial ? "spatial" : approved ? "galaxy-approved" : "galaxy") + ".js?v=20261027-cinematic";
  script.onerror = function () { var canvas = document.getElementById("field"); if (canvas) canvas.style.display = "none"; };
  document.head.appendChild(script);
})();
