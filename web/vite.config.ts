import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createGitHubBridgePlugin } from './viteServerBridge';

export default defineConfig({
  plugins: [react(), createGitHubBridgePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
