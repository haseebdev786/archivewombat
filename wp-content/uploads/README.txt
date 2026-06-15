The Wombat Post — media folder
==============================

Post images live here, organised by year/month exactly as WordPress did:

  wp-content/uploads/2026/06/your-image.jpg

When you add a new post:
  1. Put its index.html in a folder at the site root (/post-slug/index.html).
  2. Copy that post's images here, matching the /wp-content/uploads/YYYY/MM/...
     paths that the post's HTML refers to.
  3. Run:  node tools/build-archive.mjs
  4. Upload the new files to Hostinger.

To bring in the images for the EXISTING archived posts, copy the main site's
wp-content/uploads folder into this one (it can be merged on top).
