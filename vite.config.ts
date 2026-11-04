import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";

/**
 * Stamps the service worker with a build id so each deploy gets fresh cache
 * names — otherwise a stale shell would keep serving old hashed asset paths.
 *
 * Also hands the worker the list of lazily-loaded code chunks: without it the
 * first offline launch mounts the app but the route itself never loads.
 */
function serviceWorkerBuildStamp(): Plugin {
  // Deferred analytics bundle (~335 KB) is not worth precaching; code the app
  // needs to render a route is small, so a size cap keeps install light.
  const MAX_PRECACHE_BYTES = 180_000;

  return {
    name: "hadir-sw-build-stamp",
    apply: "build",
    generateBundle(_options, bundle) {
      const template = path.resolve(__dirname, "src/sw-template.js");
      if (!fs.existsSync(template)) return;

      const chunks = Object.values(bundle)
        .filter((entry) => entry.type === "chunk")
        .filter((chunk) => Buffer.byteLength(chunk.code, "utf8") <= MAX_PRECACHE_BYTES)
        .map((chunk) => chunk.fileName)
        .sort();

      // replaceAll: the marker also appears in the file's own comment.
      const source = fs
        .readFileSync(template, "utf8")
        .replaceAll("__SW_BUILD__", String(Date.now()))
        .replaceAll("__SW_CHUNKS__", JSON.stringify(chunks));
      // Emitted as part of the bundle (not copied from public/) so the stamped
      // version is what actually lands in dist/sw.js.
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// https://vite.dev/config/
// GitHub Pages serves the site from /<repo>/ — derive the base path from the
// repository name in CI; local dev and other hosts use "/".
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  base: repoName ? `/${repoName}/` : "/",
  plugins: [react(), tailwindcss(), serviceWorkerBuildStamp()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages so no dependency
    // resolves its own React copy and triggers "Invalid hook call" errors.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and lazy loading
        manualChunks: {
          // Vendor chunks for large libraries
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'convex-vendor': ['convex'],
          // Large UI library chunks
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          // Heavy optional libraries - separate chunks for better lazy loading
          'framer-motion': ['framer-motion'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@convex-dev/auth/react',
      'framer-motion',
    ],
  },
  // Performance hints
  server: {
    // Bind to all interfaces so WebContainer's server-ready event fires.
    host: true,
    port: 5173,
    // The preview/browser origin must be able to reach the local Convex
    // backend that runs on this machine: browsers hitting the dev server from
    // elsewhere would resolve 127.0.0.1 to their own host. VITE_CONVEX_URL/
    // VITE_CONVEX_SITE_URL point at these prefixed paths instead, and the
    // prefix is stripped before forwarding (WebSocket upgrade included).
    proxy: {
      "^/convex(/.*)?$": {
        target: "http://127.0.0.1:3210",
        ws: true,
        rewrite: (path) => path.replace(/^\/convex/, "") || "/",
      },
      "^/convex-site(/.*)?$": {
        target: "http://127.0.0.1:3211",
        rewrite: (path) => path.replace(/^\/convex-site/, "") || "/",
      },
    },
    // Keep HMR on, but disable full-screen error overlay
    hmr: {
      overlay: false,
    },
  },
});
