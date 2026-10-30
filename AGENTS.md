# Project verification

- Node 22.12+; npm install; npm run dev.
- npm run generate:csv regenerates both committed CSV samples using seed 78539.
- npm test: Vitest/jsdom, component and analytics/storage/provider/dataset tests.
- npm run build: strict TypeScript then Vite production build including dedicated worker.
- npx playwright install chromium; npm run test:e2e: real-browser integration and 100k worker smoke.
- Live HTTP AI is the default per the updated product request; explicit VITE_AI_MODE=mock must never require an API key or send external AI requests. Vitest/Playwright regression tests explicitly select mock mode.
- npm start serves dist and the real AI adapter on localhost:3000 using Node type stripping (Node 24.15 verified). Build before starting.
- npm run dev -- --port 5174 then npm run test:live checks real-model browser flows; INSIGHTFLOW_URL overrides the target. This check depends on upstream availability.
- AI Stack /api/analyze cannot express multiple metrics; use /api/chat with the validated InsightFlow specification. Server-only AI_STACK_BASE_URL selects the upstream. Never forward raw rows; configure HTTPS before sending sensitive schema/questions.
- Keep raw CSV rows in the data worker, never Redux/localStorage. Preserve conservative inference and validate specs against dataset columns.
- Analysis lifecycle belongs in src/services/analysis.ts, never in a route component cleanup. Navigating away must not abort analysis or clear status. Explicit Stop, dataset replacement, and conversation reset cancel active runs; ignore late results.
- Initial CSV uploads create a local, validated starter via src/core/starter.ts when no custom widgets exist. No AI call is made. The first successful question replaces the starter; saved dashboards are preserved. Explicit reveal requests scroll new/updated widgets into view without moving desktop chat or keyboard focus.
- Use src/core/id.ts createId for browser IDs. Public HTTP origins do not expose crypto.randomUUID; getRandomValues remains available and generates RFC 4122 v4 IDs. Regression coverage disables randomUUID before app startup.
