# `@lowerdeck/telemetry`

Shared OpenTelemetry bootstrap and execution-context trace fallback helpers.

## Installation

```bash
npm install @lowerdeck/telemetry
yarn add @lowerdeck/telemetry
bun add @lowerdeck/telemetry
pnpm add @lowerdeck/telemetry
```

## Usage

```typescript
import { initTelemetry, withExecutionContextTraceFallback } from '@lowerdeck/telemetry';

initTelemetry({
  serviceName: 'my-service',
  allowRootSpans: true
});

let result = await withExecutionContextTraceFallback(async () => {
  return await doWork();
});
```

Notes:
- Root spans are disabled by default.
- Set `allowRootSpans: true` for services that should create root traces themselves.
- `OTEL_ALLOW_ROOT_SPANS=true` also enables root spans.

## Environment Variables

### `OTEL_ENABLED`
- Type: `'true' | 'false'`
- Default: `'false'`
- What it does: enables telemetry initialization and trace fallback behavior.

Example:

```bash
export OTEL_ENABLED=true
```

### `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- Type: string (URL)
- Required when `OTEL_ENABLED=true`
- What it does: full OTLP traces endpoint used by the HTTP exporter.

Example:

```bash
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://example.com/otlp/v1/traces"
```

### `OTEL_EXPORTER_OTLP_HEADERS`
- Type: comma-separated `key=value` pairs
- Default: empty
- What it does: custom HTTP headers sent with OTLP export requests (typically auth).

Example:

```bash
export OTEL_EXPORTER_OTLP_HEADERS="x-sentry-auth=sentry sentry_key=secret-key"
```

### `OTEL_ALLOW_ROOT_SPANS`
- Type: `'true' | 'false'`
- Default: `'false'`
- What it does: enables creating root spans in the service when no parent trace exists.

Example:

```bash
export OTEL_ALLOW_ROOT_SPANS=true
```

### `OTEL_TRACES_SAMPLER_ARG`
- Type: number between `0` and `1`
- Default: `0.01`
- What it does: sets the proportion of new root traces to export. Parent trace sampling decisions are preserved so a sampled request remains sampled across services.

Example:

```bash
export OTEL_TRACES_SAMPLER_ARG=0.05
```

### `OTEL_PRISMA_SPAN_MIN_DURATION_MS`
- Type: number (`>= 0`)
- Default: `100`
- What it does: successful Prisma spans (`prisma:*`) shorter than this duration are dropped before export — they are leaf spans created for every database query and otherwise dominate the span volume of a trace. Prisma spans that failed — error status, exception event, or error attributes — are always kept. Set to `0` to keep every Prisma span.

Example:

```bash
export OTEL_PRISMA_SPAN_MIN_DURATION_MS=250
```

### `OTEL_SERVICE_NAME`
- Type: string
- Default: value passed to `initTelemetry({ serviceName })`
- What it does: overrides the service name resource attribute.

Example:

```bash
export OTEL_SERVICE_NAME="metorial-api"
```

### `OTEL_RESOURCE_ATTRIBUTES`
- Type: comma-separated `key=value` pairs
- Default: empty
- What it does: adds extra OTEL resource attributes to every exported span.

Example:

```bash
export OTEL_RESOURCE_ATTRIBUTES="service.namespace=subspace,deployment.environment=development,team=platform"
```

### `OTEL_DEBUG`
- Type: `'true' | 'false'`
- Default: `'false'`
- What it does: enables OpenTelemetry diagnostic logging.

Example:

```bash
export OTEL_DEBUG=true
```

Note:
- `deployment.environment.name` resource attribute defaults to `METORIAL_ENV`, then `NODE_ENV`, then `'development'`.
