import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';

/**
 * Ensures GitHub Pages deployment works under both:
 * 1. GitHub Actions artifact deployment (`dist/`), and
 * 2. Direct GitHub Pages branch deployment (`main` root -> `/public/gh-pages-bundle/`),
 * while guaranteeing `404.html` and `.nojekyll` are always present.
 */
function githubPagesBundlePlugin(): Plugin {
  return {
    name: 'h1-github-pages-bundle',
    closeBundle() {
      const rootDir = path.resolve(import.meta.dirname, '.');
      const distDir = path.join(rootDir, 'dist');
      const assetsDir = path.join(distDir, 'assets');
      const fallbackDir = path.join(rootDir, 'public', 'gh-pages-bundle');

      if (!fs.existsSync(distDir)) return;

      // Ensure 404.html and .nojekyll exist in dist/ and repository root
      const public404 = path.join(rootDir, 'public', '404.html');
      if (fs.existsSync(public404)) {
        fs.copyFileSync(public404, path.join(distDir, '404.html'));
        fs.copyFileSync(public404, path.join(rootDir, '404.html'));
      }
      fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
      fs.writeFileSync(path.join(rootDir, '.nojekyll'), '');

      // Copy compiled JS & CSS into public/gh-pages-bundle/ for branch-mode fallback
      if (fs.existsSync(assetsDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
        const files = fs.readdirSync(assetsDir);
        const jsFile = files.find((f) => f.endsWith('.js'));
        const cssFile = files.find((f) => f.endsWith('.css'));

        if (jsFile) {
          fs.copyFileSync(path.join(assetsDir, jsFile), path.join(fallbackDir, 'app.js'));
          const distRootFallback = path.join(distDir, 'gh-pages-bundle');
          fs.mkdirSync(distRootFallback, { recursive: true });
          fs.copyFileSync(path.join(assetsDir, jsFile), path.join(distRootFallback, 'app.js'));
          const distPublicFallback = path.join(distDir, 'public', 'gh-pages-bundle');
          fs.mkdirSync(distPublicFallback, { recursive: true });
          fs.copyFileSync(path.join(assetsDir, jsFile), path.join(distPublicFallback, 'app.js'));
        }
        if (cssFile) {
          fs.copyFileSync(path.join(assetsDir, cssFile), path.join(fallbackDir, 'app.css'));
          const distRootFallback = path.join(distDir, 'gh-pages-bundle');
          fs.mkdirSync(distRootFallback, { recursive: true });
          fs.copyFileSync(path.join(assetsDir, cssFile), path.join(distRootFallback, 'app.css'));
          const distPublicFallback = path.join(distDir, 'public', 'gh-pages-bundle');
          fs.mkdirSync(distPublicFallback, { recursive: true });
          fs.copyFileSync(path.join(assetsDir, cssFile), path.join(distPublicFallback, 'app.css'));
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/agentflow-ai/',
    plugins: [react(), tailwindcss(), githubPagesBundlePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
