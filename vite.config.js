import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works over http(s) on Firebase Hosting
  // AND over file:// inside the Electron desktop app. Safe here because the
  // app uses hash routing (#/sell), so the document path is always root.
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves (see src/main.js) so we can skip it inside
      // the Electron desktop shell, where file:// has no service-worker support.
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Shop Manager',
        short_name: 'ShopMS',
        description: 'Simple POS: sales, stock and daily cash reconciliation',
        theme_color: '#166534',
        background_color: '#f5f5f3',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
