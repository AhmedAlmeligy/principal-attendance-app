/*
 * Hadir service worker.
 *
 * Goals, in order:
 *  1. A launch paints from cache immediately instead of waiting on a
 *     round-trip — the app is a PWA people open several times a day.
 *  2. The app still starts with no connection at all.
 *  3. A new deploy is picked up on the following launch: the cached shell is
 *     revalidated in the background after every navigation, and the assets it
 *     references are pre-cached at install.
 *
 * `__SW_BUILD__` is replaced with a timestamp at build time, so every deploy
 * gets fresh cache names and the old entries are dropped on activate.
 */
const BUILD = "__SW_BUILD__";
/** Code chunks emitted by the build, lazy routes included. */
const CHUNKS = __SW_CHUNKS__;
const SHELL_CACHE = `hadir-shell-${BUILD}`;
const ASSET_CACHE = `hadir-assets-${BUILD}`;

/** The HTML shell React mounts into (served at the scope root). */
function shellHref() {
  return new URL(self.registration.scope).href;
}

/** Content-hashed files worth keeping offline. */
function isAsset(request, pathname) {
  if (/\/assets\//.test(pathname)) return true;
  if (["script", "style", "font", "image"].includes(request.destination)) return true;
  return /\.(js|css|woff2?|png|svg|ico|webp)$/.test(pathname);
}

const EXTRA_ASSETS = ["logo.svg", "icon-192.png", "manifest.webmanifest"];

function assetRefs(html, base) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = match[1];
    if (/\.(js|css|woff2?|svg|png|ico|webp|webmanifest)$/.test(raw)) refs.add(new URL(raw, base).href);
  }
  for (const chunk of CHUNKS) refs.add(new URL(chunk, base).href);
  for (const extra of EXTRA_ASSETS) refs.add(new URL(extra, base).href);
  return refs;
}

/** Fonts are only referenced from inside the CSS, so follow those pointers. */
async function cacheCssFonts(cache, cssHrefs) {
  await Promise.all(
    [...cssHrefs].map(async (href) => {
      if (await cache.match(href, { ignoreVary: true })) return;
      await fetchInto(cache, href);
    }),
  );
  const cssEntries = await Promise.all(
    [...cssHrefs].map((href) => cache.match(href, { ignoreVary: true })),
  );
  const fonts = new Set();
  for (const entry of cssEntries) {
    if (!entry) continue;
    const text = await entry.clone().text();
    for (const match of text.matchAll(/url\(([^)]*\.woff2?)\)/g)) {
      const raw = match[1].replace(/["']/g, "").trim();
      if (raw.startsWith("data:")) continue;
      fonts.add(new URL(raw, entry.url || self.location.origin).href);
    }
  }
  await Promise.all([...fonts].map((href) => fetchInto(cache, href)));
}

async function fetchInto(cache, href) {
  try {
    const response = await fetch(href, { cache: "reload" });
    if (response.ok) await cache.put(href, response);
  } catch {
    /* offline during install — on-demand caching will pick it up later */
  }
}

/** Install-time: cache the shell and every asset it references. */
async function precache() {
  const url = shellHref();
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
  if (!response || !response.ok) return;
  const html = await response.clone().text();
  await shell.put(url, response);
  const refs = [...assetRefs(html, url)];
  await Promise.all(refs.map((href) => fetchInto(assets, href)));
  await cacheCssFonts(assets, refs.filter((href) => href.endsWith(".css")));
}

/**
 * Post-navigation: refresh the shell, then fetch only the assets the new shell
 * references that we do not already have. Cheap no-op when nothing changed.
 */
async function refreshShell() {
  const url = shellHref();
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !type.includes("text/html")) return;
  const shell = await caches.open(SHELL_CACHE);

  const html = await response.clone().text();
  const previous = await shell.match(url);
  if (previous && (await previous.clone().text()) === html) return;

  await shell.put(url, response);
  const assets = await caches.open(ASSET_CACHE);
  const refs = [...assetRefs(html, url)];
  await Promise.all(
    refs.map(async (href) => {
      if (await assets.match(href, { ignoreVary: true })) return;
      await fetchInto(assets, href);
    }),
  );
  await cacheCssFonts(assets, refs.filter((href) => href.endsWith(".css")));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("hadir-") && !keep.has(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  // ignoreVary: the responses were stored by the worker's own fetch, whose
  // Accept-Encoding differs from the page's, and Cache.match honours Vary.
  const hit = (await cache.match(request, { ignoreVary: true })) || (await cache.match(request.url, { ignoreVary: true }));
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) void cache.put(request.url, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch the Convex API, PostHog, or anything else cross-origin.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (request.mode === "navigate") {
    // Serve the cached shell in one frame; refresh it afterwards. A first visit
    // (nothing cached yet) simply goes to the network.
    event.respondWith(
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.match(shellHref()))
        .then((cached) => cached || fetch(request)),
    );
    event.waitUntil(refreshShell().catch(() => {}));
    return;
  }

  if (isAsset(request, url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
