import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'HDB_')
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api/v1': { target: env.HDB_FASTAPI_TARGET ?? 'http://127.0.0.1:8001' },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  }
})
