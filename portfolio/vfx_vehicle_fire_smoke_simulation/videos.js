/* VIDEO CONFIGURATION: paste the three YouTube URLs (or 11-character video IDs)
   below. Supports youtube.com/watch, /embed, /shorts, and youtu.be links.
   Empty or invalid entries remain hidden. No autoplay; only one Houdini iframe
   exists at a time, so switching views stops playback of the previous view. */
(function () {
  "use strict";
  var videos = {
    front: "YPJB0TsJ-Vw",
    rear: "ea8yt1AMmLY",
    unreal: "3nkOGp8eL-0"
  };

  function videoId(value) {
    value = value.trim();
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
      var url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      var host = url.hostname.replace(/^www\./, "");
      var id;
      if (host === "youtu.be") id = url.pathname.slice(1);
      else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].indexOf(host) !== -1) {
        id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:embed|shorts)\/([^/]+)$/.exec(url.pathname);
        if (Array.isArray(id)) id = id[1];
      }
      return typeof id === "string" && /^[\w-]{11}$/.test(id) ? id : null;
    } catch (e) { return null; }
  }

  function showVideo(section, id, title) {
    section.hidden = false;
    var frame = document.createElement("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/" + id;
    frame.title = "Vehicle Fire & Smoke Simulation — " + title;
    frame.width = "1280";
    frame.height = "720";
    frame.loading = section.id === "houdini-video" ? "eager" : "lazy";
    frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    section.querySelector("[data-player]").replaceChildren(frame);
    var link = section.querySelector("[data-watch]");
    link.href = "https://youtu.be/" + id;
    link.setAttribute("aria-label", "Watch " + title + " on YouTube");
  }

  var section = document.getElementById("houdini-video");
  var buttons = Array.from(section.querySelectorAll("[data-view]"));
  var available = buttons.filter(function (button) {
    var id = videoId(videos[button.dataset.view]);
    button.hidden = !id;
    return !!id;
  });
  function select(button) {
    if (button.getAttribute("aria-pressed") === "true") return;
    available.forEach(function (item) { item.setAttribute("aria-pressed", String(item === button)); });
    showVideo(section, videoId(videos[button.dataset.view]), button.textContent);
  }
  available.forEach(function (button) {
    button.addEventListener("click", function () { select(button); });
  });
  if (available.length) {
    section.querySelector(".vehicle-views").hidden = available.length < 2;
    document.getElementById("simulation-still").hidden = true;
    select(available[0]);
  }
  var unreal = videoId(videos.unreal);
  if (unreal) showVideo(document.getElementById("unreal-video"), unreal, "Unreal Engine Visualization");
})();
