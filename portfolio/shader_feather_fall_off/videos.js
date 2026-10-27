/* Additional views load on request; native YouTube links work without JS. */
(function () {
  "use strict";
  document.querySelectorAll(".feather [data-video]").forEach(function (frame) {
    var button = frame.querySelector("button");
    button.hidden = false;
    button.addEventListener("click", function () {
      var player = document.createElement("iframe");
      player.src = "https://www.youtube-nocookie.com/embed/" + frame.dataset.video;
      player.title = button.dataset.title;
      player.width = "1600"; player.height = "900";
      player.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share";
      player.referrerPolicy = "strict-origin-when-cross-origin";
      player.allowFullscreen = true;
      frame.replaceChildren(player);
      player.focus();
    }, { once: true });
  });
})();
