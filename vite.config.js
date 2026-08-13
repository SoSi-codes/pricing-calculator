import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GITHUB_REPOSITORY is set automatically by GitHub Actions (e.g. "soumya/pricing-calculator").
// We extract the repo name to use as the base path for GitHub Pages.
// When running locally this env var is absent, so base defaults to '/' (dev server works normally).
const repoName = process.env.GITHUB_REPOSITORY
  ? '/' + process.env.GITHUB_REPOSITORY.split('/')[1] + '/'
  : '/';

export default defineConfig({
  base: repoName,
  plugins: [react()],
  css: {
    // lightningcss in Vite 8 does not yet support @position-try used by Carbon v1.114+.
    // Disable CSS minification to avoid parse errors; JS minification is unaffected.
    transformer: 'postcss',
    preprocessorOptions: {
      scss: {
        includePaths: ['node_modules'],
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api', 'mixed-decls', 'import'],
      },
    },
  },
  build: {
    cssMinify: false,
  },
});
