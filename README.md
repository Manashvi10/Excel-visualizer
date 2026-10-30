# InsightFlow

A local-first CSV analyst and interactive dashboard builder. React 19, TypeScript, Vite, Tailwind 4, shadcn-style Radix primitives, Redux Toolkit, Recharts, PapaParse, Zod, TanStack Table/Virtual, React Grid Layout, and Dexie.

## Start

Requires Node.js 22.12+ (tested on Node 24) and npm.

```sh
npm install
npm run dev
```

Open the address printed by Vite. Default provider is **live AI**, connected through the application-owned `/api/ai/analyze` route to the AI Stack service in the supplied Postman collection. No frontend API key is required: the upstream service manages its own model credentials. Optional settings are in `.env.example`; copy it to `.env` to override defaults. Never put an LLM key in a `VITE_*` setting. Service availability, model quality and rate limits are controlled by the upstream operator; failures are shown rather than silently using mock answers.

For a production build with its application server:

```sh
npm run build
npm start
```

Open `http://localhost:3000`. Node 22.18+ or 24 is recommended for the built-in TypeScript runtime (Node 24.15 tested). `npm start` reads optional `.env`; `HOST` defaults to localhost and `PORT` to 3000. Configure an HTTPS reverse proxy, authentication and per-client rate limiting before public deployment. Static-only hosting cannot run the AI route: deploy the Node server or implement the same endpoint on your hosting platform.

The supplied upstream uses **plain HTTP**. Raw CSV rows are never sent, but column names, questions and chart/filter configuration can still be sensitive. Configure `AI_STACK_BASE_URL` to a trusted HTTPS service before submitting sensitive information. The local server has request-size/concurrency limits, a 90-second timeout, disconnect cancellation and at most one model-output correction retry.

### Public HTTP deployments

Browser `crypto.randomUUID()` is restricted to secure contexts (HTTPS or localhost), so it is missing on URLs such as `http://<server-ip>:4173`. All application IDs use `src/core/id.ts`: native UUIDs when available, otherwise version-4 UUIDs built with `crypto.getRandomValues()`, without insecure random-number fallbacks. This covers worker requests, chat, chart widgets, save/share and dashboard imports/duplicates. Clipboard APIs may also be unavailable on HTTP; sharing already falls back to a JSON configuration download.

After deploying changes, rebuild the frontend and restart the process serving it. For the existing Vite-preview setup: `npm ci`, `npm run build`, then `npm run preview -- --port 4173`. Reload the browser with Ctrl+Shift+R to discard old JavaScript. Vite preview is for build inspection, not a hardened production server; use `npm start` behind an HTTPS reverse proxy for production. HTTPS is recommended even though the ID fallback supports HTTP.

## Try it

1. Open **Analyze Data** and click **Load sample data** (1,200 rows), or drop/upload a CSV.
2. Click a suggested question or ask `Show total revenue by region`.
3. Ask `Change the current chart to a line chart`, then `Show only 2025 data`.
4. Ask `Show only the South region` or `Sort the results by revenue in descending order`.
5. A new analytical question adds another chart; follow-ups modify the selected chart. Click a chart to select it. Undo restores a previous chart configuration.
6. Drag a chart using its grip, resize from its corner, change type with the selector, export PNG, or remove it. Mobile uses a stacked layout with dragging disabled.
7. Save a dashboard with the top-bar action. **My Dashboards** supports open, rename, duplicate, delete, and configuration import. Current chart configuration also survives reloads, but CSV rows do not: load the corresponding file again.
8. **Data Explorer** offers worker-backed search, column text filters, sorting, and virtual scrolling.

Enter submits a question; Shift+Enter inserts a newline. Stop cancels the active request. Theme persists across reloads. Icon actions have accessible names/tooltips. Destructive user actions request confirmation.

## Actual CSV deliverables

- `public/sample-data/sales-demo.csv`: 1,200 deterministic synthetic sales rows plus header.
- `public/sample-data/sales-100k.csv`: exactly 100,000 deterministic sales rows plus header.
- `scripts/generate-sales-csv.mjs`: dependency-free generator, seed 78539.

```sh
npm run generate:csv
```

Both files are included and downloadable through the UI (small sample in the upload state; large sample in Settings). The generator rewrites both reproducibly without network access. Upload `sales-100k.csv`, ask `Show monthly revenue`, then explore/search/sort it in Data Explorer. Tests check row counts, all regions/products, and `revenue = quantity × unit_price`, `profit = revenue − cost`. No fixed performance guarantee is asserted.

### Real-world restaurant dataset

`public/sample-data/restaurant-tips-real.csv` contains the 244 original restaurant-bill observations (7 columns) from the public Seaborn tips dataset, not synthetic/generated records. Source: https://raw.githubusercontent.com/mwaskom/seaborn-data/master/tips.csv ; background: https://huggingface.co/datasets/scikit-learn/tips . Values and original column names are preserved. `total_bill` and `tip` are dollar amounts; `size` is the dining party size; `day` and `time` describe the visit, and `sex`/`smoker` are the source's recorded categorical labels. This is a small historical, nonrepresentative dataset, not current restaurant-market data.

Upload it through **Upload CSV** or download `/sample-data/restaurant-tips-real.csv` from a running development server. For production serving, rebuild to copy the new file into `dist`. Ask “Show total total_bill by day”, “Show average tip by time”, or “Compare total_bill and tip by day”. Follow up with “Change the current chart to a bar chart” or “Show only Dinner records”. No date column exists, so year/month filters are not applicable. Verification totals: 244 rows, 7 columns, total bills 4827.77 and total tips 731.58. The sales generator does not overwrite this file.

## Mock mode today

Supported rules include sum/average/count/min/max of named columns; grouping by named categories; monthly/daily/quarterly/yearly date grouping; multiple named numeric metrics (up to three); top five/ten/N; bar/line/area/pie; year and North/South/East/West region filters; sorting; and removing filters. Representative prompts:

- Show total revenue by region
- Show monthly revenue
- Compare revenue and profit by month
- Show the top five products by revenue
- Show profit by category as a pie chart
- Create a chart comparing sales channels
- Show average order value by region

This is deterministic parsing, **not a real LLM**. Unsupported prompts return an explanation, not a fabricated chart. Short configurable progress stages are simulated, not streamed LLM tokens. Every displayed metric is calculated from the actual loaded CSV. Average order value is average revenue per CSV row; this assumes one order per row.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Vitest covers parsing/inference, strict schema/column validation, filters, aggregations, date buckets, sorting, top-N, missing/empty results, provider prompts/follow-ups/cancellation, storage corruption, CSV relationships, and component states. Playwright exercises real worker parsing/analysis, follow-up identity, save/reload, mobile/theme, no external mock requests, and 100k virtual-table smoke testing. See final implementation report for commands actually run and environment limitations.

## Live AI integration

1. `server/api.ts` implements application-owned `POST /api/ai/analyze`, available in Vite dev/preview and the production Node server (`server/index.ts`). Its validated input is `{ question, columns, current? }`; its output is `{ spec, text, update }`.
2. `server/adapter.ts` prepares a structured-output prompt and sends no sample rows. The server calls the supplied AI Stack **`POST /api/chat`**, receiving `{ answer, model }`. The collection's `/api/analyze` route only supports one metric and rejects comparisons; `/api/chat` permits InsightFlow's richer multi-metric contract.
3. The JSON answer is parsed (optional markdown fencing is stripped), validated with Zod and checked against the actual columns. Invalid output receives one correction attempt, then a recoverable error. There is no mock fallback. Unsupported requests, network errors, 429s and timeout failures do not create charts.
4. The adapter also understands the collection's legacy `{ spec: { type:'chart', chart, x, y, agg, filters, sort, limit, title } }` format for compatible single-metric responses. Unsupported chart types or groupings are rejected.
5. `HttpAIProvider` revalidates the response in the browser and the worker validates before calculating. Explicit follow-ups carry the current specification and preserve the selected widget identity. Create-versus-edit routing is application-controlled: new analytical questions omit the old chart from the model context, so a model's incorrect update flag cannot overwrite an unrelated chart. The model still generates all analytic fields.
6. To replace AI Stack with direct server-side Gemini/OpenAI integration, change only the upstream call in `server/api.ts`: keep credentials in server-only variables, request JSON matching `analysisSchema`, and retain `normalizeResponse`/semantic validation. No React, chart, worker or Redux rewrite is required. Never call a secret-bearing provider from browser code.
7. To add genuine streaming, implement the provider's stage callback from validated SSE/NDJSON events and honor AbortSignal. Current live mode is a single JSON response with honest request/validation/analysis stages, not token streaming.

For explicitly offline deterministic operation set `VITE_AI_MODE=mock` and restart Vite (or rebuild). Vitest and the regression Playwright suite explicitly select this mode to avoid nondeterministic external dependencies. The separate live smoke script uses the real server and model; it is not part of offline tests. Run `npm run dev -- --port 5174`, then `npm run test:live` in another terminal. It verifies actual CSV chart rendering, chart-type follow-up, 2025 filtering and multi-metric comparison. Set `INSIGHTFLOW_URL` to test another running live-mode instance. Failures can reflect upstream outages/rate limits or incorrect model output and are not silently bypassed.

If future code sends sanitized example rows, add an explicit consent flow explaining that those rows and the question leave the device. Minimize sample size, redact identifiers, and never automatically send the complete CSV.

## Privacy and limitations

Mock mode uses no external AI/network calls; fetching the bundled CSV is same-origin. Charts/layouts, theme, and the last 40 conversation messages are compact localStorage data. Questions and configuration can contain sensitive names: clear conversations or browser storage when needed. Raw datasets live in the dedicated worker. Optional **Remember this CSV** stores a file in IndexedDB only after opt-in; load/forget it from Settings. Sharing includes configuration, titles, filters, and dataset filename, never raw rows; recipients must provide their own matching CSV. Review configuration content before sharing. Oversized links fall back to downloadable JSON; clipboard failures also download JSON.

CSV accepts comma separators, unique nonblank headers, matching row lengths, finite strict numbers, and valid `YYYY-MM-DD` dates. Leading-zero identifiers stay strings. A column mixing numbers and text stays a string, so it cannot accidentally aggregate malformed values as zero. Blank cells are null. Currency/thousands-formatted numbers and ambiguous locale dates remain strings; normalize them before upload. Quoted CSV fields are supported. Pie charts reject negative values and excessive unbounded categories. Results cap at 100 groups with a visible warning; use explicit top-N or narrower filters. Multiple metrics are supported; a separate categorical secondary-series pivot is not currently exposed.

Parsing and operations execute in one dedicated worker. Progress represents measurable file-read/parse stages, not byte-level CSV parsing. Cancelled results are ignored by request ID; an already-running synchronous computation inside the worker cannot be preempted mid-loop. Cancelling upload terminates the worker; replacement starts a fresh worker. Search requests are debounced and obsolete results ignored. Parsing retains the CSV text and intermediate structures in worker memory during ingestion, so limits above the tested 100k rows depend on device memory.

Live chart planning depends on upstream availability and model adherence to the schema; valid JSON can still misunderstand a question, so verify important results. Use explicit follow-up wording such as “Change…”, “Filter…”, “Show only…”, “Sort…” or “current chart” to edit a widget; other questions start a new analysis. Invalid outputs are rejected, and real-mode progress is stage-based rather than token streaming.

Saved/shared configurations require a matching CSV after reload. Local saving is not cloud sync, and configuration sharing is not a hosted public-dashboard service. No authentication is implied by the local profile placeholder.

See `docs/architecture.md` and `docs/technical-decisions.md` for details.
