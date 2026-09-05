/* Contact page: copy buttons, and a composer that hands off to the mail app. */

(function () {
  "use strict";

  /* ---------- copy a value to the clipboard --------------------------- */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // file:// and plain http have no clipboard API — fall back to a scratch field
    return new Promise(function (resolve, reject) {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(t);
      ok ? resolve() : reject(new Error("copy unavailable"));
    });
  }

  document.querySelectorAll(".copy").forEach(function (btn) {
    var label = btn.textContent;
    var timer;

    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy") || "";
      copyText(value).then(function () {
        btn.textContent = "Copied";
        btn.classList.add("is-done");
      }).catch(function () {
        btn.textContent = "Select it";
      }).then(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove("is-done");
        }, 1800);
      });
    });
  });

  /* ---------- composer ------------------------------------------------- */
  /*
     No server, so this fills out a message in whatever mail app the visitor
     already uses. Nothing is sent from the page and nothing is stored.

     To collect messages on the page instead, sign up for a form service
     (Formspree, Basin, Web3Forms), wrap the fields in a real <form> with
     action="https://their-endpoint" method="POST", and delete this file.
  */

  var send = document.querySelector(".send");
  if (!send) return;

  var status = document.querySelector(".compose__status");
  var to = send.getAttribute("data-to") || "";

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  send.addEventListener("click", function () {
    var name = val("from-name");
    var email = val("from-email");
    var subject = val("subject");
    var message = val("message");

    if (!message) {
      status.textContent = "Add a message first.";
      var m = document.getElementById("message");
      if (m) m.focus();
      return;
    }

    var body = message;
    if (name || email) {
      body += "\n\n—\n" + (name || "") + (email ? "\n" + email : "");
    }

    var href = "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent(subject || "Hello") +
      "&body=" + encodeURIComponent(body);

    status.textContent = "Opening your mail app.";
    window.location.href = href;

    setTimeout(function () {
      status.textContent = "No mail app opened? Copy the address above instead.";
    }, 3000);
  });
})();
