import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',fullyParallel:false,use:{baseURL:'http://127.0.0.1:5173',headless:true,trace:'retain-on-failure'},webServer:{env:{VITE_AI_MODE:'mock'},command:'npm run dev -- --port 5173 --force',stdout:'pipe',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},timeout:60000});
