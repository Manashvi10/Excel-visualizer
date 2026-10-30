# Architecture

## Flow

`CSV File → DataClient → dedicated module Web Worker → PapaParse + conservative inference → worker-owned rows`

Only dataset metadata and eight preview rows return to Redux. The table requests bounded row ranges. Charts receive aggregates, never the entire dataset.

`Question + column schema + selected spec → AIProvider → Zod + semantic column validation → RUN_ANALYSIS → local filter/group/aggregate/sort/limit → Recharts`

MockAIProvider uses deterministic rules isolated from React and the analysis engine. HttpAIProvider implements the identical interface using an application-owned endpoint. Provider output cannot execute JavaScript. Analysis operations are pure functions in `src/core/engine.ts`, tested independently and called in `src/workers/data.worker.ts`.

## Modules

- `src/core/schema.ts`: runtime/TypeScript contracts, semantic validation.
- `src/core/starter.ts`: deterministic schema-based initial overview planning; no AI calls, invented columns or fabricated values.
- `src/core/engine.ts`: CSV parsing, inference, filtering, date grouping, aggregation, table queries.
- `src/core/protocol.ts`: discriminated worker request/response messages and request IDs.
- `src/services/worker.ts`: lazy worker lifecycle, promises, AbortSignal handling, stale response suppression, crash recovery.
- `src/services/analysis.ts`: application-scoped request lifecycle, provider/worker orchestration, duplicate prevention, cancellation, stale-response protection and chart commits independent of the current route.
- `src/providers/ai.ts`: provider interfaces, mock rules, HTTP adapter, prompt suggestions.
- `src/state/store.ts`: shared dataset metadata, bounded conversations, widgets/layouts, selected chart, aggregate cache, UI status/theme, saved dashboards, bounded undo.
- `src/services/persistence.ts`: versioned Zod-validated localStorage, optional IndexedDB file, configuration encoding.
- `src/components`: analyst, canvas, chart widget, upload, table explorer, dashboard library, Radix/variant-based UI primitive.
- `src/App.tsx`: shell, routing, overview/settings, save dialog, share/import recovery.

## Analysis lifecycle

Analysis belongs to the application service, not the Assistant component. Navigating to Data Explorer, Settings or the dashboard library does not abort the AI request or clear progress. Completed charts, responses and errors commit to Redux even when Analyze Data is not mounted. Returning restores the progress/Stop control or completed visualization. Retry derives its question from bounded Redux conversation history, not page-local state. Stop, dataset replacement, and starting a new conversation invalidate the active run; late provider/worker results cannot overwrite a newer analysis. Background errors produce a toast and remain recoverable in the assistant. A full browser reload still ends the in-memory session.

## Starter charts and canvas reveal

A dataset-change subscription creates a starter specification only for an empty canvas or an untouched previous starter. It uses real inferred columns, validates the spec, and leaves aggregation to the same worker-backed Canvas pipeline. The first successful question replaces the starter's stable widget ID; later requests follow normal create/edit semantics. Restored or customized dashboards are preserved. The starter marker is session-only; saved widgets remain ordinary validated specifications.

Explicit Redux reveal requests carry a widget ID and revision so both new widgets and same-ID updates are brought into view. Canvas waits for a render frame, scrolls only its own desktop overflow container, and uses document scrolling for the stacked mobile layout. Reduced-motion requests use instant scrolling. Selection alone does not steal focus or trigger scrolling; background completions are revealed when Analyze Data mounts again.

## Worker lifecycle and concurrency

Messages include PARSE_CSV, PARSE_PROGRESS, PARSE_SUCCESS, PARSE_ERROR, GET_PREVIEW, RUN_ANALYSIS, GET_TABLE_ROWS, CANCEL_OPERATION and success/error variants. Each uses a unique request ID. The client maps replies to their promises and discards obsolete replies after cancellation. Worker crashes reject outstanding requests; re-upload is the recovery boundary. File replacement terminates the old worker. A parse commits rows only after validation. Filters and table sorting never execute in React render.

The worker is deliberately single-threaded: operations queue. Cancellation prevents stale commits but cannot interrupt a synchronous loop already executing; upload cancellation terminates the worker. Raw datasets are never serialized to Redux/localStorage. Dataset replacement revalidates every saved chart and shows missing-column errors.

## Persistence and sharing

`insightflow:v1` stores a version marker, theme, current widgets, saved dashboards, and up to 40 messages. Zod failures/malformed/outdated JSON recover to safe defaults. Write/quota failures notify the user. Widget identity, chart specs, and grid x/y/w/h persist. Dataset contents are session-only by default. Opt-in IndexedDB remembers one file and Settings can load or remove it.

Share links encode a validated dashboard configuration as UTF-8 base64 in the URL fragment. They contain no raw rows or examples. Filenames, filter values, and titles remain potentially sensitive. Links above 7,000 characters fall back to JSON download. Imports and links are bounded and validated before restoration. A recipient uploads the corresponding CSV to calculate results.

## Server integration boundary

POST configured `VITE_AI_ENDPOINT` with `{question:string, columns:Column[], current?:AnalysisSpec}`. Return `{spec:AnalysisSpec,text:string,update:boolean}`. `update=true` retains the selected widget ID; a new question creates a new ID. See README for server credential, validation, rate limiting, and optional streaming requirements. Both HTTP and mock outputs undergo browser semantic validation. The frontend never talks directly to a secret-bearing model endpoint.

Real AI is now the default. Vite dev/preview installs `server/api.ts` as middleware; `npm start` serves the production build and the same API with `server/index.ts`. `server/adapter.ts` validates requests, prepares a schema-only prompt, parses the AI Stack `/api/chat` answer, and validates the resulting spec against dataset columns. The service's `/api/analyze` format is also understood for compatible single-metric results, but that route cannot express all required comparisons. An invalid model response receives one bounded correction attempt; explicit unsupported responses return a recoverable error immediately. Create-versus-edit routing is application-controlled from explicit follow-up language. Only edits receive the selected specification; new analytical questions do not inherit the previous chart or its filters. The server does not trust the model's widget-update flag. Raw CSV rows and preview samples are never forwarded. Timeout and client disconnect abort the upstream request. No deterministic/mock fallback runs in live mode.

`AI_STACK_BASE_URL` is server-only. The supplied HTTP origin is configurable; use HTTPS before processing sensitive questions/schema. The lightweight server is intended for a local workspace. Public deployments require an HTTPS reverse proxy, authentication and per-client abuse controls in addition to the built-in size/concurrency limits. Node 24.15 runs the TypeScript server using built-in type stripping; build/typecheck covers imported server modules. Tests explicitly select mock mode; `npm run test:live` runs a separate real-model browser smoke against `INSIGHTFLOW_URL` (default port 5174).
