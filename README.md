# Next.js: a route handler sets `http.route` on an HTTP server span that has already ended

A minimal App Router app: one dynamic page (`app/items/[id]/page.jsx`) and one dynamic route handler (`app/api/items/[id]/route.js`). It's started with `next start`, with `@opentelemetry/instrumentation-http` registered before Next loads (`otel-preload.cjs`, via `NODE_OPTIONS=--require`). That makes the instrumentation's incoming-request SERVER span the parent of Next's `BaseServer.handleRequest` span. Any platform that creates the HTTP span itself has this same shape.

Verified on **2026-10-21** with `next@16.5.0-canary.21` (the latest canary on npm) and `next@16.4.2`, on Node 24 / Linux.

## Steps

1. `npm install`
2. `node repro.mjs 16.5.0-canary.21` (or `node repro.mjs 16.4.2`)

`repro.mjs` installs the requested `next`, then builds the app and starts `next start -p 3123` with the preload. It sends 10 page requests and 10 route-handler requests, then counts the OpenTelemetry SDK's `Cannot execute the operation on ended Span` warnings in the server output.

## Expected

No warnings. Next shouldn't write to a span after that span has ended.

## Actual

```
next 16.5.0-canary.21, page: 0 "ended Span" warnings over 10 requests
next 16.5.0-canary.21, route handler: 10 "ended Span" warnings over 10 requests
```

That's one warning, with a two-frame SDK stack, for every route-handler request. In production this buries real server errors: about 130K lines a day across 10 containers in our app.

## Why

In `packages/next/src/server/base-server.ts`, `handleRequest` captures `parentSpan = tracer.getActiveScopeSpan()`, which is the instrumentation's SERVER span. After the response has finished, `handleRequestImpl(...).finally()` ("Propagate http.route to the parent span") calls `parentSpan.setAttribute('http.route', route)`. By then, `@opentelemetry/instrumentation-http` has already ended that span on the response's `finish`, so the SDK refuses the write and warns.

## Control

Add `&& parentSpan.isRecording()` to the `if (parentSpan && parentSpan !== span)` line in `node_modules/next/dist/server/base-server.js`, then run `REPRO_KEEP_INSTALL=1 node repro.mjs`. Route handlers then show 0 / 10 warnings.

_This reproduction was written by Christopher Chedeau's coding agent at his direction._
