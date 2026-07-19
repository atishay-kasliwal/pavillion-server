import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Service-token vars intentionally lack the VITE_ prefix so they can never
  // end up in the client bundle — they exist only for the dev proxy below.
  const env = loadEnv(mode, process.cwd(), '')
  const accessHeaders =
    env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
      ? {
          'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
          'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
        }
      : undefined

  return {
    plugins: [react()],
    build: {
      // The API serves the SPA same-origin — build straight into api/public,
      // which is committed so the server picks it up with git pull.
      outDir: '../api/public',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://archive.atishaykasliwal.com',
          changeOrigin: true,
          headers: accessHeaders,
        },
      },
    },
  }
})
