import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogSource, SourceKind } from '../types';
import { ExtractionError } from '../lib/extraction';

let requestTimeoutMs = 30_000;
let userAgent = 'metorial-model-catalog';

export interface ParsedSource<T> {
  data: T;
  issues: string[];
}

export interface SourceResult<T> {
  meta: CatalogSource;
  data: T | null;
  raw: unknown;
  issues: string[];
}

// Snapshots one run already fetched, so repeated builds within that run see identical inputs.
export interface PinnedSources {
  dir: string;
  meta: Map<SourceKind, CatalogSource>;
}

export interface LoadSourceOptions<T> {
  kind: SourceKind;
  ref: string;
  offline: boolean;
  previousDir: string | null;
  pinned?: PinnedSources | null;
  fetch: () => Promise<unknown>;
  parse: (raw: unknown) => ParsedSource<T>;
  now: string;
}

export let fetchJson = async (url: string) => {
  let response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': userAgent },
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return response.json() as Promise<unknown>;
};

export let fetchText = async (url: string) => {
  let response = await fetch(url, {
    headers: { 'user-agent': userAgent },
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return response.text();
};

export let sourceSnapshotPath = (dir: string, kind: SourceKind) =>
  path.join(dir, 'sources', `${kind}.json`);

let readPreviousSnapshot = async (previousDir: string | null, kind: SourceKind) => {
  if (!previousDir) return null;

  let file = sourceSnapshotPath(previousDir, kind);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
};

export let readPinnedSources = async (dir: string): Promise<PinnedSources> => {
  let file = path.join(dir, 'catalog.json');
  let sources = existsSync(file)
    ? ((JSON.parse(await readFile(file, 'utf8')) as { sources?: CatalogSource[] }).sources ??
      [])
    : [];

  return { dir, meta: new Map(sources.map(source => [source.kind, source])) };
};

let loadPinned = async <T>(
  opts: LoadSourceOptions<T>,
  pinned: PinnedSources
): Promise<SourceResult<T>> => {
  let meta = pinned.meta.get(opts.kind) ?? {
    kind: opts.kind,
    ref: opts.ref,
    fetchedAt: opts.now,
    status: 'fresh',
    error: null
  };
  let raw = await readPreviousSnapshot(pinned.dir, opts.kind);
  if (raw === null)
    return { meta: { ...meta, status: 'missing' }, data: null, raw: null, issues: [] };

  let parsed = opts.parse(raw);
  return { meta, data: parsed.data, raw, issues: parsed.issues };
};

// A secondary source failing must not stop a scheduled build: fall back to the snapshot the
// previous run stored, and record which state each source was in.
export let loadSource = async <T>(opts: LoadSourceOptions<T>): Promise<SourceResult<T>> => {
  if (opts.pinned) return loadPinned(opts, opts.pinned);

  let fetchError: string | null = opts.offline ? 'offline' : null;

  if (!opts.offline) {
    try {
      let raw = await opts.fetch();
      let parsed = opts.parse(raw);
      return {
        meta: {
          kind: opts.kind,
          ref: opts.ref,
          fetchedAt: opts.now,
          status: 'fresh',
          error: null
        },
        data: parsed.data,
        raw,
        issues: parsed.issues
      };
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      fetchError = (err as Error).message;
    }
  }

  try {
    let raw = await readPreviousSnapshot(opts.previousDir, opts.kind);
    if (raw !== null) {
      let parsed = opts.parse(raw);
      return {
        meta: {
          kind: opts.kind,
          ref: opts.ref,
          fetchedAt: opts.now,
          status: 'fallback',
          error: fetchError
        },
        data: parsed.data,
        raw,
        issues: parsed.issues
      };
    }
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    fetchError = `${fetchError}; fallback: ${(err as Error).message}`;
  }

  return {
    meta: {
      kind: opts.kind,
      ref: opts.ref,
      fetchedAt: opts.now,
      status: 'missing',
      error: fetchError
    },
    data: null,
    raw: null,
    issues: []
  };
};

export let parseItems = <T>(
  items: unknown[],
  parseItem: (item: unknown) => T,
  label: (item: unknown, index: number) => string
): ParsedSource<T[]> => {
  let data: T[] = [];
  let issues: string[] = [];

  items.forEach((item, index) => {
    try {
      data.push(parseItem(item));
    } catch (err) {
      issues.push(`${label(item, index)}: ${(err as Error).message}`);
    }
  });

  return { data, issues };
};

export let perUnit = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;

  let parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export let perToken = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;

  let parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 1e6 * 1e6) / 1e6;
};
