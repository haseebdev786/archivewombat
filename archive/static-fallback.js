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
          '<img src="https://staging.oldwombat.com/wp-content/uploads/2024/12/newwombat-logo.webp" alt="The Wombat Post" width="399" height="87">' +
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

  function replaceExportedFooter() {
    if (document.querySelector(".static-site-footer")) return;

    var oldFooter = document.getElementById("footer");
    if (!oldFooter) return;

    var footer = document.createElement("footer");
    footer.className = "static-site-footer";
    footer.innerHTML =
      '<div class="static-site-footer__inner">' +
        '<div class="static-site-footer__top">' +
          '<div class="static-site-footer__brand">' +
            '<p class="static-site-footer__brand-name"><a href="/">The Wombat Post</a></p>' +
            '<p class="static-site-footer__tagline">Daylesford and Hepburn Springs community news archive</p>' +
          "</div>" +
          '<nav class="static-site-footer__nav" aria-label="Footer navigation">' +
            '<a href="https://staging.oldwombat.com/about-the-wombat-post/">About the Wombat Post</a>' +
            '<a href="https://staging.oldwombat.com/editorial-policy/">Editorial Policy</a>' +
            '<a href="https://staging.oldwombat.com/contact-us/">Contact Us</a>' +
            '<a href="https://staging.oldwombat.com/membership-cancellation/">Membership Cancellation</a>' +
            '<a href="https://staging.oldwombat.com/advertising-rates/">Advertising Rates</a>' +
            '<a href="https://staging.oldwombat.com/privacy-policy/">Privacy Policy</a>' +
          "</nav>" +
        "</div>" +
        '<div class="static-site-footer__bottom">' +
          '<p class="static-site-footer__ack">The Wombat Post acknowledges the Dja Dja Wurrung people as the Traditional Owners of the land on which we live and work.</p>' +
          '<p class="static-site-footer__meta">The Wombat Post &mdash; static archive.</p>' +
        "</div>" +
      "</div>";

    oldFooter.parentNode.replaceChild(footer, oldFooter);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizePath(path) {
    var out = String(path || "").split("#")[0].split("?")[0];
    if (!out) out = "/";
    if (out.charAt(0) !== "/") out = "/" + out;
    out = out.replace(/\/index\.html?$/i, "/");
    if (out !== "/" && out.charAt(out.length - 1) !== "/") out += "/";
    return out;
  }

  function mediaHTML(post) {
    if (!post || !post.image) {
      return '<span class="static-related__image static-related__image--empty" aria-hidden="true">W</span>';
    }
    return (
      '<span class="static-related__image">' +
        '<img src="' + esc(post.image) + '" alt="" loading="lazy" ' +
        'onerror="this.parentNode.classList.add(\'static-related__image--empty\');this.parentNode.textContent=\'W\';">' +
      "</span>"
    );
  }

  function navItemHTML(post, label, direction) {
    if (!post) return '<span class="static-post-nav__item static-post-nav__item--empty"></span>';
    return (
      '<a class="static-post-nav__item static-post-nav__item--' + direction + '" href="' + esc(post.url) + '">' +
        '<span class="static-post-nav__button">' + (direction === "prev" ? "&lsaquo; " : "") + esc(label) + (direction === "next" ? " &rsaquo;" : "") + "</span>" +
        '<span class="static-post-nav__title">' + esc(post.title) + "</span>" +
      "</a>"
    );
  }

  function relatedCardHTML(post) {
    return (
      '<article class="static-related__post">' +
        '<a class="static-related__media-link" href="' + esc(post.url) + '">' + mediaHTML(post) + "</a>" +
        '<h4 class="static-related__title"><a href="' + esc(post.url) + '">' + esc(post.title) + "</a></h4>" +
        (post.date ? '<p class="static-related__date">' + esc(post.date) + "</p>" : "") +
      "</article>"
    );
  }

  function renderPostExtras(posts) {
    if (!document.body.classList.contains("single-post")) return;

    var currentPath = normalizePath(window.location.pathname);
    var current = null;
    for (var i = 0; i < posts.length; i++) {
      if (normalizePath(posts[i].url) === currentPath) {
        current = posts[i];
        break;
      }
    }
    if (!current || !current.categories || !current.categories.length) return;

    var category = current.categories[0];
    var categoryPosts = posts.filter(function (post) {
      return (post.categories || []).indexOf(category) !== -1;
    }).sort(function (a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    var index = categoryPosts.findIndex(function (post) {
      return normalizePath(post.url) === currentPath;
    });
    if (index === -1) return;

    var newer = categoryPosts[index - 1] || null;
    var older = categoryPosts[index + 1] || null;
    var related = [];
    for (var r = index + 1; r < categoryPosts.length && related.length < 4; r++) {
      if (normalizePath(categoryPosts[r].url) !== currentPath) related.push(categoryPosts[r]);
    }
    for (var n = index - 1; n >= 0 && related.length < 4; n--) {
      if (normalizePath(categoryPosts[n].url) !== currentPath) related.push(categoryPosts[n]);
    }

    var navHTML =
      '<nav class="post-nav static-post-nav" aria-label="Adjacent posts in ' + esc(category) + '">' +
        '<div class="static-post-nav__links">' +
          navItemHTML(older, "Previous", "prev") +
          navItemHTML(newer, "Next", "next") +
        "</div>" +
      "</nav>";

    var relatedHTML = related.length
      ? '<section class="et_extra_other_module related-posts static-related" aria-label="Related posts">' +
          '<div class="related-posts-header static-related__header"><h3>Related Posts</h3></div>' +
          '<div class="related-posts-content static-related__grid">' + related.map(relatedCardHTML).join("") + "</div>" +
        "</section>"
      : "";

    var oldNav = document.querySelector(".post-nav");
    if (oldNav) {
      oldNav.outerHTML = navHTML;
    } else {
      var article = document.querySelector(".single-post-module");
      if (article) article.insertAdjacentHTML("afterend", navHTML);
    }

    var oldRelated = document.querySelector(".related-posts");
    if (oldRelated) {
      oldRelated.outerHTML = relatedHTML;
    } else {
      var target = document.querySelector(".post-nav.static-post-nav") || document.querySelector(".single-post-module");
      if (target && relatedHTML) target.insertAdjacentHTML("afterend", relatedHTML);
    }
  }

  function hydratePostExtras() {
    if (!document.body.classList.contains("single-post")) return;
    fetch("/search-index.json")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(renderPostExtras)
      .catch(function (error) {
        console.error("Failed to load related posts", error);
      });
  }

  ensureStylesheet();
  replaceExportedHeader();
  replaceExportedFooter();
  document.querySelectorAll(".post-thumbnail.header img").forEach(checkImage);
  hydratePostExtras();
})();
