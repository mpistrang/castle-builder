import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/shared\//, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['phaser', 'socket.io-client'],
  },
  server: {
    port: 3001,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
