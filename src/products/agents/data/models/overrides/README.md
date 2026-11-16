# Catalog overrides

The catalog is generated deterministically from models.dev and live vendor listings. The files
here are the only place where people (or the reconcile agent) correct it. Every file is plain JSON
keyed by the thing it overrides, so an edit touches one entry and nothing else.

Every entry has a `reason` (required, at most 400 characters) and optionally `by` (`human` or
`agent`) and `at` (`YYYY-MM-DD`). The reconcile job stamps `by` and `at` on what the agent decides.
Run `bun run generate --offline` after editing; it fails on a malformed file.

## `offerings/<vendorId>.json` — what a vendor's model name is

Keyed by the vendor's own model id, exactly as the vendor lists it (the offering's
`vendorModelId`). One of four decisions:

```json
{
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": {
    "decision": "link",
    "model": "deepseek/deepseek-r1-distill-qwen-32b",
    "reason": "Same checkpoint; models.dev links it to the full DeepSeek R1"
  },
  "auto": {
    "decision": "router",
    "reason": "Routes each request to a model the vendor picks"
  },
  "acme/support-bot-ft-7": {
    "decision": "exclude",
    "category": "fine-tune",
    "reason": "A customer fine-tune, not a model anyone else can call"
  },
  "newlab/brand-new-1": {
    "decision": "defer",
    "until": "2026-12-01",
    "reason": "Released this week; models.dev has no entry for it yet"
  }
}
```

- `link` — the offering serves this catalog model. `model` must be an existing model id
  (`<lab>/<slug>`, as in `models.json` of the generated catalog). Never invent one.
- `router` — the name picks a model per request (auto, best, fallback routers).
- `exclude` — the offering is not something the catalog models. `category` is one of `fine-tune`,
  `deployment` (a customer's private deployment or endpoint alias), `non-chat` (embedding, image,
  speech, rerank or moderation model that no catalog model matches), `test`, or `other`.
- `defer` — a real model the catalog doesn't know yet, usually because models.dev hasn't added it.
  `until` is at most 30 days ahead; after that day the offering is raised as an issue again.

A `link` whose model later disappears, or a `defer` that runs out, does not fail the build: the
offering resolves normally again and shows up in `issues.json`.

## `merges.json` — two models.dev entries that are one model

```json
{
  "deepseek/deepseek-v3.1": {
    "from": ["deepseek/deepseek-chat-v3.1"],
    "reason": "models.dev has two lab files for the same checkpoint"
  }
}
```

Keyed by the model id that survives. Merges change published model ids, so only people edit this
file; the reconcile job reverts agent edits to it, and to the two files below.

## `models.json` and `families.json` — corrections to a model or family

```json
{ "acme/acme-1": { "name": "Acme One", "familyId": "acme/acme", "reason": "…" } }
```

`models.json` takes `name`, `familyId` and `derivedFrom`; `families.json` takes `name`.
