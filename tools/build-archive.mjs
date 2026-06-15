#!/usr/bin/env node
/**
 * build-archive.mjs — The Wombat Post static archive generator
 * --------------------------------------------------------------
 * Scans every post folder in the site root, pulls a small amount of
 * metadata out of each scraped WordPress page, and writes:
 *
 *   search-index.json   → the data the homepage + search bar read
 *
 * It also makes sure every post page links the shared cleanup stylesheet
 * (/archive-cleanup.css) so newly-added posts render in the clean
 * "archive" format automatically.
 *
 * The script is idempotent: run it as often as you like. The normal
 * workflow is:
 *   1. Drop a newly-archived post folder (e.g. /my-post-slug/index.html)
 *      into the site root, exactly as the rest are laid out.
 *   2. Run:  node tools/build-archive.mjs
 *   3. Upload the changed files to Hostinger.
 *
 * No npm install required — it uses only Node's standard library.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "search-index.json");
const CLEANUP_LINK = '<link rel="stylesheet" href="/archive-cleanup.css">';

// Folders that are never posts.
const SKIP_DIRS = new Set([
  "wp-content",
  "wp-includes",
  "wp-json",
  "category",
  "author",
  "page",
  "tag",
  "feed",
  "comments",
  "tools",
  "archive",
]);

// A folder is only treated as a post if its index.html contains this marker
// (the single-article template). This excludes the homepage, category and
// author listing pages, etc.
const POST_MARKER = "single-post-module";

// How many characters of body text to keep for the card excerpt.
const EXCERPT_LENGTH = 200;

// Where post images are served from.
//
// Default is empty = root-relative (/wp-content/uploads/...), i.e. images are
// served from THIS site's own uploads folder. This is the reliable option:
// the live site only keeps current media, so archived posts' images 404 there.
//
// If you ever want to pull images from another host, set a base, e.g.:
//   IMAGE_BASE=https://example.com node tools/build-archive.mjs
// Switching is safe — the generator normalises upload URLs each run, so you can
// change or clear IMAGE_BASE freely without breaking previously-written pages.
const IMAGE_BASE = process.env.IMAGE_BASE || "";

// Any absolute upload URL is normalised back to this root-relative prefix
// before IMAGE_BASE (if any) is applied. Keeps the rewrite idempotent.
const UPLOADS_PATH = "/wp-content/uploads/";

// ---------------------------------------------------------------------------
// Small HTML helpers (regex-based — the scraped markup is very consistent)
// ---------------------------------------------------------------------------

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Isolate the main <article ... single-post-module ...> block so we never
 *  pick up data from "Related Posts" or prev/next navigation that follow it. */
function articleBlock(html) {
  const start = html.search(/<article\b[^>]*single-post-module/);
  if (start === -1) return null;
  const end = html.indexOf("</article>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function firstMatch(re, str) {
  const m = re.exec(str);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Per-post extraction
// ---------------------------------------------------------------------------

function extractPost(slug, html) {
  const block = articleBlock(html);
  if (!block) return null;

  // Skip password-protected posts — they have no readable content.
  if (block.includes("post-password-form")) return null;

  // Title: prefer the article's <h1 class="entry-title">; some older page
  // layouts have no such heading, so fall back to the og:title meta tag
  // (with the site suffix trimmed off).
  let title = stripTags(
    firstMatch(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/, block) || ""
  );
  if (!title) {
    const ogTitle = decodeEntities(
      firstMatch(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/, html) || ""
    );
    const docTitle = stripTags(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/, html) || "");
    title = (ogTitle || docTitle).replace(/\s*[-|]\s*The Wombat Post\s*$/i, "").trim();
  }
  if (!title) return null;

  // Display date: first ".updated" span inside the article header.
  const dateText = stripTags(
    firstMatch(/<span[^>]*class="[^"]*updated[^"]*"[^>]*>([\s\S]*?)<\/span>/, block) || ""
  );

  // Sortable timestamp: prefer the machine-readable published_time meta tag
  // from the document head, fall back to parsing the display date.
  const publishedMeta = firstMatch(
    /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/,
    html
  );
  let timestamp = publishedMeta ? Date.parse(publishedMeta) : NaN;
  if (Number.isNaN(timestamp) && dateText) timestamp = Date.parse(dateText);
  if (Number.isNaN(timestamp)) timestamp = 0;

  // Categories: the rel="tag" links inside the post meta.
  const metaBlock =
    firstMatch(/<div[^>]*class="[^"]*post-meta vcard[^"]*"[^>]*>([\s\S]*?)<\/div>/, block) || "";
  const categories = [
    ...metaBlock.matchAll(/<a[^>]*rel="tag"[^>]*>([\s\S]*?)<\/a>/g),
  ].map((m) => stripTags(m[1]));

  // Thumbnail: the header post-thumbnail image, else the first content image.
  let image =
    firstMatch(
      /<div[^>]*class="[^"]*post-thumbnail[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/,
      block
    ) || firstMatch(/<img[^>]*src="([^"]+)"/, block);
  if (image) {
    // Normalise any absolute upload URL back to root-relative, then apply base.
    image = image.trim().replace(/^https?:\/\/[^/]*\/wp-content\/uploads\//, UPLOADS_PATH);
    if (IMAGE_BASE && image.startsWith("/")) image = IMAGE_BASE + image;
  }

  // Excerpt: first paragraph of the article body.
  const content =
    firstMatch(
      /<div[^>]*class="[^"]*post-content entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/,
      block
    ) || "";
  let excerpt = "";
  for (const m of content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = stripTags(m[1]);
    if (text) {
      excerpt = text;
      break;
    }
  }
  if (excerpt.length > EXCERPT_LENGTH) {
    excerpt = excerpt.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, "") + "…";
  }

  return {
    title,
    url: `/${slug}/`,
    date: dateText,
    timestamp,
    categories,
    image,
    excerpt,
  };
}

// ---------------------------------------------------------------------------
// Page transforms (pure: take html, return html)
// ---------------------------------------------------------------------------

/** Add the shared cleanup stylesheet link if it isn't already present. */
function ensureCleanupLink(html) {
  if (html.includes("archive-cleanup.css")) return html;
  const headClose = html.indexOf("</head>");
  if (headClose === -1) return html;
  return html.slice(0, headClose) + "  " + CLEANUP_LINK + "\n" + html.slice(headClose);
}

/** When IMAGE_BASE is set, point root-relative upload URLs at the live site so
 *  article images load without the uploads folder being present locally.
 *  Idempotent: a path is only rewritten when preceded by a URL delimiter
 *  (quote / space / comma / paren), so already-absolute URLs are left alone. */
function rewriteUploads(html) {
  // 1. Normalise any absolute upload URL back to a root-relative path. This
  //    makes the transform idempotent and lets IMAGE_BASE be changed/cleared.
  let out = html.replace(
    /https?:\/\/[^"'\s,()]*\/wp-content\/uploads\//g,
    UPLOADS_PATH
  );
  // 2. If a base is configured, prefix root-relative upload paths with it.
  if (IMAGE_BASE) {
    out = out.replace(
      /(["'\s,(])\/wp-content\/uploads\//g,
      `$1${IMAGE_BASE}${UPLOADS_PATH}`
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const entries = readdirSync(ROOT, { withFileTypes: true });
  const posts = [];
  let scanned = 0;
  let patched = 0;
  const skippedTrashed = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (SKIP_DIRS.has(slug) || slug.startsWith(".")) continue;
    if (slug.includes("__trashed")) {
      skippedTrashed.push(slug);
      continue;
    }

    const filePath = join(ROOT, slug, "index.html");
    let html;
    try {
      if (!statSync(filePath).isFile()) continue;
      html = readFileSync(filePath, "utf8");
    } catch {
      continue; // no index.html in this folder
    }

    if (!html.includes(POST_MARKER)) continue; // not a single post page

    scanned++;

    // Extract metadata from the current page, then apply the page transforms
    // and write back only if something actually changed.
    const post = extractPost(slug, html);
    if (post) posts.push(post);
    else console.warn(`!  Could not extract metadata: ${slug}`);

    const updated = rewriteUploads(ensureCleanupLink(html));
    if (updated !== html) {
      writeFileSync(filePath, updated);
      patched++;
    }
  }

  // Newest first.
  posts.sort((a, b) => b.timestamp - a.timestamp);

  writeFileSync(OUTPUT, JSON.stringify(posts, null, 0));

  console.log(`✓ Scanned ${scanned} post pages`);
  console.log(`✓ Wrote ${posts.length} entries to search-index.json`);
  if (patched) console.log(`✓ Updated ${patched} post page(s) (cleanup link / image URLs)`);
  if (IMAGE_BASE) console.log(`✓ Images point at ${IMAGE_BASE}`);
  if (skippedTrashed.length)
    console.log(`ℹ Skipped ${skippedTrashed.length} __trashed folder(s)`);
}

main();
