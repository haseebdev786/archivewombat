(function () {
  "use strict";

  // Mobile navigation toggle
  var siteHeader = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  if (siteHeader) {
    var scrollTicking = false;
    var updateHeaderState = function () {
      siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
      scrollTicking = false;
    };

    updateHeaderState();
    window.addEventListener("scroll", function () {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(updateHeaderState);
    }, { passive: true });
  }

  var PAGE_SIZE = 24;
  var HOME_FEATURED_PAGE_SIZE = 4;
  var SECTION_LEAD = 1;
  var SECTION_LINKS = 4;
  var INDEX_URL = "/search-index.json";
  var FRONT_INDEX_URL = "/archive/front-index.json";
  var FEATURED_SECTIONS = [
    { title: "News", category: "News", accent: "teal", href: "/?category=News" },
    { title: "Features", category: "Features", accent: "blue", href: "/?category=Features" },
    { title: "Living well", category: "Living well", accent: "pink", href: "/?category=Living%20well" },
  ];

  var els = {
    q: document.getElementById("q"),
    category: document.getElementById("category"),
    grid: document.getElementById("grid"),
    count: document.getElementById("count"),
    empty: document.getElementById("empty"),
    loadMore: document.getElementById("loadMore"),
    total: document.getElementById("total"),
    categoryCards: document.getElementById("categoryCards"),
    thisWeek: document.getElementById("thisWeek"),
    homeFeatured: document.getElementById("homeFeatured"),
    homeFeaturedGrid: document.getElementById("homeFeaturedGrid"),
    homeFeaturedPagination: document.getElementById("homeFeaturedPagination"),
    archiveTitle: document.querySelector(".archive-heading h1"),
    archiveIntro: document.querySelector(".archive-heading p"),
  };

  var allPosts = [];
  var filtered = [];
  var rendered = 0;
  var initialParams = new URLSearchParams(window.location.search);
  var frontData = null;
  var fullIndexPromise = null;
  var homeFeaturedPage = 1;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function indexPost(p) {
    p._search = (
      p.title + " " + (p.categories || []).join(" ") + " " + (p.excerpt || "")
    ).toLowerCase();
    return p;
  }

  function postsInCategory(category, limit) {
    if (!allPosts.length && frontData && frontData.sections && frontData.sections[category]) {
      return frontData.sections[category].slice(0, limit);
    }

    var out = [];
    for (var i = 0; i < allPosts.length && out.length < limit; i++) {
      if ((allPosts[i].categories || []).indexOf(category) !== -1) out.push(allPosts[i]);
    }
    return out;
  }

  function mediaHTML(p, className) {
    if (!p || !p.image) {
      return '<span class="' + className + ' ' + className + '--empty" aria-hidden="true">W</span>';
    }
    return (
      '<span class="' + className + '">' +
        '<img src="' + esc(p.image) + '" alt="" loading="lazy" ' +
        "onerror=\"this.parentNode.classList.add('" + className + "--empty');this.parentNode.textContent='W';\">" +
      "</span>"
    );
  }

  function featuredHTML(section) {
    var posts = postsInCategory(section.category, SECTION_LEAD + SECTION_LINKS);
    if (!posts.length) return "";

    var lead = posts[0];
    var rest = posts.slice(SECTION_LEAD);

    var leadHTML =
      '<a class="feature-card__lead" href="' + esc(lead.url) + '">' +
        mediaHTML(lead, "feature-card__media") +
        '<div class="feature-card__body">' +
          '<h3 class="feature-card__title">' + esc(lead.title) + "</h3>" +
          '<p class="feature-card__meta">' + esc(lead.date || "") + "</p>" +
          (lead.excerpt ? '<p class="feature-card__excerpt">' + esc(lead.excerpt) + "</p>" : "") +
        "</div>" +
      "</a>";

    var restHTML = rest.length
      ? '<ul class="feature-card__list">' + rest.map(function (p) {
          return (
            '<li><a href="' + esc(p.url) + '">' +
              mediaHTML(p, "feature-card__list-media") +
              '<span class="feature-card__list-text">' +
                '<span class="feature-card__list-title">' + esc(p.title) + "</span>" +
                '<span class="feature-card__list-meta">' + esc(p.date || "") + "</span>" +
              "</span>" +
            "</a></li>"
          );
        }).join("") + "</ul>"
      : "";

    return (
      '<section class="feature-card feature-card--' + section.accent + '">' +
        '<h2 class="feature-card__head">' +
          '<a href="' + esc(section.href) + '">' + esc(section.title) + "</a>" +
        "</h2>" +
        leadHTML +
        restHTML +
      "</section>"
    );
  }

  function homeFeaturedCardHTML(p) {
    var cats = (p.categories || []).join(", ");
    return (
      '<article class="home-post-card">' +
        '<a class="home-post-card__media-link" href="' + esc(p.url) + '">' +
          mediaHTML(p, "home-post-card__media") +
        "</a>" +
        '<div class="home-post-card__body">' +
          '<h3 class="home-post-card__title"><a href="' + esc(p.url) + '">' + esc(p.title) + "</a></h3>" +
          '<p class="home-post-card__meta">' +
            esc(p.date || "") +
            (cats ? " | " + esc(cats) : "") +
          "</p>" +
          (p.excerpt ? '<p class="home-post-card__excerpt">' + esc(p.excerpt) + "</p>" : "") +
          '<a class="home-post-card__button" href="' + esc(p.url) + '">Read More</a>' +
        "</div>" +
      "</article>"
    );
  }

  function renderHomeFeaturedPage(page) {
    if (!els.homeFeatured || !els.homeFeaturedGrid || !els.homeFeaturedPagination) return;

    var posts = frontData && frontData.featuredPosts ? frontData.featuredPosts : [];
    var totalPages = Math.max(1, Math.ceil(posts.length / HOME_FEATURED_PAGE_SIZE));
    homeFeaturedPage = Math.min(Math.max(page, 1), totalPages);

    var start = (homeFeaturedPage - 1) * HOME_FEATURED_PAGE_SIZE;
    var pagePosts = posts.slice(start, start + HOME_FEATURED_PAGE_SIZE);
    els.homeFeatured.hidden = !pagePosts.length;
    els.homeFeaturedGrid.innerHTML = pagePosts.map(homeFeaturedCardHTML).join("");

    if (totalPages <= 1) {
      els.homeFeaturedPagination.innerHTML = "";
      return;
    }

    var pages = [];
    var visible = [
      homeFeaturedPage,
      homeFeaturedPage + 1,
      homeFeaturedPage + 2,
      totalPages - 1,
      totalPages,
    ].filter(function (n, i, arr) {
      return n >= 1 && n <= totalPages && arr.indexOf(n) === i;
    });

    pages.push(
      '<button type="button" class="home-featured__page" data-page="' +
        Math.max(homeFeaturedPage - 1, 1) +
        '" aria-label="Previous page"' +
        (homeFeaturedPage === 1 ? " disabled" : "") +
        ">&lsaquo;</button>"
    );

    visible.forEach(function (n, i) {
      if (i && n - visible[i - 1] > 1) pages.push('<span class="home-featured__gap">...</span>');
      pages.push(
        '<button type="button" class="home-featured__page' +
          (n === homeFeaturedPage ? " is-active" : "") +
          '" data-page="' + n + '">' + n + "</button>"
      );
    });

    pages.push(
      '<button type="button" class="home-featured__page" data-page="' +
        Math.min(homeFeaturedPage + 1, totalPages) +
        '" aria-label="Next page"' +
        (homeFeaturedPage === totalPages ? " disabled" : "") +
        ">&rsaquo;</button>"
    );

    els.homeFeaturedPagination.innerHTML = pages.join("");
  }

  function renderFrontPage() {
    els.categoryCards.innerHTML = FEATURED_SECTIONS.map(featuredHTML).join("");
    var weekPosts = frontData && frontData.thisWeek ? frontData.thisWeek : allPosts.slice(0, 10);
    els.thisWeek.innerHTML = weekPosts.map(function (p) {
      return (
        '<a class="week-link" href="' + esc(p.url) + '">' +
          '<span class="week-link__title">' + esc(p.title) + "</span>" +
          (p.date ? '<span class="week-link__date">' + esc(p.date) + "</span>" : "") +
        "</a>"
      );
    }).join("");
    renderHomeFeaturedPage(1);
  }

  function cardHTML(p) {
    var cats = (p.categories && p.categories.length)
      ? '<span class="card__cats">' + esc(p.categories[0]) + "</span>"
      : "";
    var date = p.date ? '<span class="card__date">' + esc(p.date) + "</span>" : "";

    return (
      '<a class="card" href="' + esc(p.url) + '">' +
        mediaHTML(p, "card__media") +
        '<span class="card__body">' +
          cats +
          '<h2 class="card__title">' + esc(p.title) + "</h2>" +
          (p.excerpt ? '<span class="card__excerpt">' + esc(p.excerpt) + "</span>" : "") +
          date +
        "</span>" +
      "</a>"
    );
  }

  function letterCardHTML(p) {
    return (
      '<article class="letter-card">' +
        '<h2 class="letter-card__title"><a href="' + esc(p.url) + '">' + esc(p.title) + "</a></h2>" +
        (p.date ? '<p class="letter-card__date">' + esc(p.date) + "</p>" : "") +
        (p.excerpt ? '<p class="letter-card__excerpt">' + esc(p.excerpt) + "</p>" : "") +
        '<a class="letter-card__button" href="' + esc(p.url) + '">Read More</a>' +
      "</article>"
    );
  }

  function renderNextPage() {
    var slice = filtered.slice(rendered, rendered + PAGE_SIZE);
    var renderer = els.category.value === "Letters" ? letterCardHTML : cardHTML;
    els.grid.insertAdjacentHTML("beforeend", slice.map(renderer).join(""));
    rendered += slice.length;
    els.loadMore.hidden = rendered >= filtered.length;
  }

  function render() {
    els.grid.innerHTML = "";
    rendered = 0;

    var n = filtered.length;
    els.empty.hidden = n !== 0;
    if (els.count) {
      els.count.textContent = n
        ? n.toLocaleString() + (n === 1 ? " post" : " posts")
        : "";
    }

    if (n) renderNextPage();
    else els.loadMore.hidden = true;
  }

  function setFilteredView(enabled) {
    document.body.classList.toggle("is-filtered-view", enabled);
    document.body.classList.toggle("is-letter-view", enabled && els.category.value === "Letters");
  }

  function updateActiveNav() {
    var selectedCategory = els.category.value;
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      var linkUrl = new URL(link.getAttribute("href"), window.location.origin);
      var linkCategory = linkUrl.searchParams.get("category") || "";
      link.classList.remove("is-active");

      if (!selectedCategory && linkUrl.pathname === "/" && !linkCategory) {
        link.classList.add("is-active");
      } else if (selectedCategory && linkCategory.toLowerCase() === selectedCategory.toLowerCase()) {
        link.classList.add("is-active");
      }
    });
  }

  function updateArchiveHeading() {
    if (!els.archiveTitle || !els.archiveIntro) return;

    var q = els.q.value.trim();
    var cat = els.category.value;

    if (cat && q) {
      els.archiveTitle.textContent = cat;
      els.archiveIntro.textContent = 'Search results for "' + q + '" in ' + cat + ".";
    } else if (cat) {
      els.archiveTitle.textContent = cat;
      els.archiveIntro.textContent = "Archived posts in " + cat + ".";
    } else if (q) {
      els.archiveTitle.textContent = "Search results";
      els.archiveIntro.textContent = 'Archived posts matching "' + q + '".';
    } else {
      els.archiveTitle.textContent = "Archive";
      els.archiveIntro.textContent = "Search the complete static archive.";
    }
  }

  function applyFilter() {
    var terms = els.q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var cat = els.category.value;

    filtered = allPosts.filter(function (p) {
      if (cat && (!p.categories || p.categories.indexOf(cat) === -1)) return false;
      for (var i = 0; i < terms.length; i++) {
        if (p._search.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });

    render();
    setFilteredView(Boolean(terms.length || cat));
    updateActiveNav();
    updateArchiveHeading();
  }

  function applyUrlParams() {
    var q = initialParams.get("q") || initialParams.get("s") || initialParams.get("search") || "";
    var cat = initialParams.get("category") || initialParams.get("cat") || "";

    if (q) els.q.value = q;
    if (cat) {
      var hasCategory = Array.prototype.some.call(els.category.options, function (opt) {
        return opt.value.toLowerCase() === cat.toLowerCase();
      });
      if (hasCategory) {
        Array.prototype.forEach.call(els.category.options, function (opt) {
          if (opt.value.toLowerCase() === cat.toLowerCase()) els.category.value = opt.value;
        });
      }
    }
  }

  function buildCategoryOptions() {
    var counts = {};
    if (frontData && frontData.counts) {
      Object.keys(frontData.counts).forEach(function (c) {
        counts[c] = frontData.counts[c];
      });
    } else {
      allPosts.forEach(function (p) {
        (p.categories || []).forEach(function (c) {
          counts[c] = (counts[c] || 0) + 1;
        });
      });
    }

    Object.keys(counts).sort().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      els.category.appendChild(opt);
    });
  }

  function setAllPosts(posts) {
    allPosts = posts.map(indexPost).sort(function (a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
    filtered = allPosts;
  }

  function loadFullIndex() {
    if (allPosts.length) return Promise.resolve(allPosts);
    if (!fullIndexPromise) {
      fullIndexPromise = fetch(INDEX_URL)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (posts) {
          setAllPosts(posts);
          return allPosts;
        });
    }
    return fullIndexPromise;
  }

  function applyFilterWithFullIndex() {
    loadFullIndex()
      .then(applyFilter)
      .catch(function (err) {
        if (els.empty) {
          els.empty.hidden = false;
          els.empty.textContent = "Could not load the post index.";
        }
        console.error("Failed to load", INDEX_URL, err);
      });
  }

  function initFront(data) {
    frontData = data;
    els.total.textContent = (data.total || 0).toLocaleString() + " posts archived.";

    renderFrontPage();
    buildCategoryOptions();
    applyUrlParams();
    if (els.q.value || els.category.value) applyFilterWithFullIndex();
    else {
      setFilteredView(false);
      updateActiveNav();
      updateArchiveHeading();
      els.grid.innerHTML = "";
      els.loadMore.hidden = true;
    }

    els.q.addEventListener("input", debounce(applyFilterWithFullIndex, 150));
    els.category.addEventListener("change", function () {
      applyFilterWithFullIndex();

      var url = new URL(window.location.href);
      if (els.category.value) url.searchParams.set("category", els.category.value);
      else url.searchParams.delete("category");

      if (els.q.value.trim()) url.searchParams.set("q", els.q.value.trim());
      else url.searchParams.delete("q");

      history.replaceState(null, "", url.pathname + url.search);
    });
    els.loadMore.addEventListener("click", renderNextPage);
    if (els.homeFeaturedPagination) {
      els.homeFeaturedPagination.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-page]");
        if (!button) return;
        renderHomeFeaturedPage(Number(button.getAttribute("data-page")));
        if (els.homeFeatured) els.homeFeatured.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }

  fetch(FRONT_INDEX_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(initFront)
    .catch(function (err) {
      if (els.empty) {
        els.empty.hidden = false;
        els.empty.textContent = "Could not load the archive index.";
      }
      console.error("Failed to load", FRONT_INDEX_URL, err);
    });
})();
