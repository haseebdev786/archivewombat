(function () {
  "use strict";

  var NAV_LINKS = [
    ["/", "Homepage"],
    ["/?category=News", "News"],
    ["/?category=Living%20well", "Living well"],
    ["/?category=Culture", "Culture"],
    ["/?category=Features", "Features"],
    ["/?category=Letters", "Letters"],
    ["/?category=Deaths", "Deaths"],
    ["/?category=Sport%20and%20recreation", "Sport"]
  ];

  function ensureStylesheet() {
    if (document.querySelector('link[href="/archive-cleanup.css"]')) return;

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/archive-cleanup.css";
    document.head.appendChild(link);
  }

  function markMissingImage(img) {
    var holder = img.closest && img.closest(".post-thumbnail.header");
    if (holder) holder.classList.add("static-image-missing");
  }

  function checkImage(img) {
    if (img.complete && img.naturalWidth === 0) markMissingImage(img);
    else img.addEventListener("error", function () { markMissingImage(img); }, { once: true });
  }

  function navHTML() {
    return NAV_LINKS.map(function (link) {
      return '<li><a href="' + link[0] + '">' + link[1] + "</a></li>";
    }).join("");
  }

  function replaceExportedHeader() {
    if (document.querySelector(".static-site-header")) return;

    var oldHeader = document.querySelector(".header.centered") || document.getElementById("main-header-wrapper");
    if (!oldHeader) return;

    var header = document.createElement("header");
    header.className = "static-site-header";
    header.innerHTML =
      '<div class="static-site-header__inner">' +
        '<a class="static-site-logo" href="/" aria-label="The Wombat Post home">' +
          '<img src="/wp-content/uploads/2024/12/newwombat-logo.webp" alt="The Wombat Post" width="399" height="87">' +
        "</a>" +
        '<button class="static-site-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">' +
          "<span></span><span></span><span></span>" +
        "</button>" +
        '<nav class="static-site-nav" aria-label="Primary navigation"><ul>' + navHTML() + "</ul></nav>" +
      "</div>";

    oldHeader.parentNode.replaceChild(header, oldHeader);

    var button = header.querySelector(".static-site-toggle");
    var nav = header.querySelector(".static-site-nav");
    button.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  ensureStylesheet();
  replaceExportedHeader();
  document.querySelectorAll(".post-thumbnail.header img").forEach(checkImage);
})();
