# The Wombat Post — Static Archive

A fully static, search-friendly archive of *The Wombat Post*. No database, no
PHP, no server-side code — it is just HTML/CSS/JS files, so it can be uploaded
to Hostinger (or any static host) by copying the folder to the web root.

## How it works

```
/                       → homepage (search + card grid)
/archive/home.css       → homepage styles (classic newspaper look)
/archive/home.js        → homepage search / filter / pagination
/search-index.json      → metadata for every post (built, see below)
/archive-cleanup.css    → strips WP chrome so each post shows clean
/<post-slug>/index.html → one scraped post per folder
/wp-content, /wp-includes → theme assets + post images
/tools/build-archive.mjs → the generator (run locally, never uploaded)
```

1. **Homepage** loads `search-index.json` and renders post cards. The search
   box and category dropdown filter that list entirely in the browser.
2. **Clicking a post** opens its `/<slug>/index.html`. That page is the
   original scraped WordPress page, but `archive-cleanup.css` hides the
   header, sidebar, footer, ads, comments and related posts so only the clean
   article remains.

## Adding new posts (the "6-months-old" workflow)

When a post on the main site turns 6 months old and you want it here:

1. Copy its exported folder into the site root, matching the existing layout:
   ```
   /my-new-post-slug/index.html
   ```
2. Make sure any images it uses live under `https://staging.oldwombat.com/wp-content/uploads/...`
   (see **Images** below).
3. Rebuild the index:
   ```
   node tools/build-archive.mjs
   ```
   This re-scans every post, rewrites `search-index.json`, and adds the
   `archive-cleanup.css` link to any new page that is missing it. It is safe
   to run as often as you like.
4. Upload the changed files (`search-index.json`, the new post folder, and any
   new images) to Hostinger.

## Images

Post images are referenced with root-relative paths like
`https://staging.oldwombat.com/wp-content/uploads/2022/04/photo.jpg`, so they are served from THIS archive
site's own `wp-content/uploads/` folder (e.g. `oldwombat.com/wp-content/...`).
Because the paths are root-relative, the archive works on any domain without
changes.

For images to show, the `wp-content/uploads/` files must be present on the
server:

- **The deploy target oldwombat.com already hosts them.** All archived images
  (and the theme CSS) return 200 there. So images work automatically — **as
  long as you do NOT delete the existing `wp-content/uploads/` and
  `wp-content/et-cache/` folders on oldwombat.com** when you upload the static
  archive on top of them.
- The main site (thewombatpost.com.au) does **not** keep old media — archived
  images 404 there — so it is not a usable image source.
- If an individual image is genuinely missing, the homepage card falls back to
  a "W" placeholder automatically; nothing else breaks.

(If you ever need to serve images from a different host, set `IMAGE_BASE` — see
the comment at the top of `tools/build-archive.mjs`. The rewrite is reversible,
so you can change or clear it any time.)

## Uploading to Hostinger

1. Run `node tools/build-archive.mjs` once locally so `search-index.json` is
   current.
2. Upload the **entire project folder contents** to `public_html` (the web
   root) via File Manager or FTP. Absolute paths (`/archive/...`,
   `/wp-content/...`, `/search-index.json`) require everything to sit at the
   root.
3. The `tools/` folder is only needed locally — you may skip uploading it.
4. No PHP, Node, or database setup is required on the host.

## Previewing locally

Because the site uses absolute paths (`/archive/...`, `/wp-content/...`), it
must be served from a web root — opening `index.html` directly with `file://`
will not load the assets. A tiny preview server is included:

```
node tools/serve.mjs        # then open http://localhost:8099
```

## Editing the look

- Homepage design: `archive/home.css`
- Homepage behaviour (page size, search): `archive/home.js`
  (`PAGE_SIZE` controls how many cards load at a time)
- Individual post cleanup rules: `archive-cleanup.css`
- What metadata is extracted per post: `tools/build-archive.mjs`

The original scraped WordPress homepage is kept as `index.wp-original.html`
for reference; it is not used by the archive.
