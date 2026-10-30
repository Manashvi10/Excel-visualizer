import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { createApiHandler } from './server/api.ts';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');const handler=createApiHandler(env.AI_STACK_BASE_URL||process.env.AI_STACK_BASE_URL||'http://72.62.135.252:8080');return { plugins: [react(), tailwindcss(), {name:'insightflow-ai-server',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}}], optimizeDeps: { include: ['papaparse', 'zod'] }, test: { env:{VITE_AI_MODE:'mock'}, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], exclude: ['e2e/**', 'node_modules/**'] } };});