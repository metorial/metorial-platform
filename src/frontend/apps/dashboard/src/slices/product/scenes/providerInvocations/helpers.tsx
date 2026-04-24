import { CodeBlock } from '@metorial/code';
import type { ReactNode } from 'react';

export let getStatusBadgeColor = (status: string) =>
  status === 'error' ? 'red' : 'green';

export let getMethodBadgeColor = (method: string | null | undefined) => {
  let normalized = method?.toUpperCase();
  if (normalized === 'GET') return 'blue' as const;
  if (normalized === 'POST') return 'green' as const;
  if (normalized === 'PUT' || normalized === 'PATCH') return 'orange' as const;
  if (normalized === 'DELETE') return 'red' as const;
  return 'gray' as const;
};

export let getResponseBadgeColor = (status: number | null | undefined) => {
  if (!status) return 'gray' as const;
  if (status >= 500) return 'red' as const;
  if (status >= 400) return 'orange' as const;
  if (status >= 200 && status < 300) return 'green' as const;
  return 'gray' as const;
};

export let formatDuration = (durationMs: number | null | undefined) => {
  if (typeof durationMs !== 'number') return null;
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
};

export let stringifyJson = (value: unknown) => {
  try {
    if (typeof value === 'string') {
      let trimmed = value.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch {}
      }
      return value;
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export let isEmptyValue = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true;
  return false;
};

export let renderJsonCodeBlock = (value: unknown) => (
  <CodeBlock
    lineNumbers={false}
    code={stringifyJson(value)}
    language="json"
    padding="12px"
  />
);

export let headersToItems = (
  headers: unknown
): { label: ReactNode; value: ReactNode }[] | null => {
  if (headers == null) return null;

  let entries: [string, unknown][] = [];

  if (Array.isArray(headers)) {
    for (let entry of headers) {
      if (Array.isArray(entry) && entry.length >= 2) {
        entries.push([String(entry[0]), entry[1]]);
      } else if (entry && typeof entry === 'object') {
        let obj = entry as { name?: unknown; key?: unknown; value?: unknown };
        let name = obj.name ?? obj.key;
        if (name != null) entries.push([String(name), obj.value]);
      }
    }
  } else if (typeof headers === 'object') {
    entries = Object.entries(headers as Record<string, unknown>);
  } else {
    return null;
  }

  if (entries.length === 0) return null;

  return entries.map(([name, value]) => ({
    label: name,
    value: typeof value === 'string' ? value : value == null ? '—' : JSON.stringify(value)
  }));
};

export let normalizeContentType = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let ct = value.toLowerCase().split(';')[0].trim();
  return ct || null;
};

export let prismLanguageForContentType = (contentType: string | null): string => {
  if (!contentType) return 'text';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('xml') || contentType.includes('html')) return 'markup';
  if (contentType.includes('yaml')) return 'yaml';
  if (contentType.includes('javascript')) return 'javascript';
  if (contentType.includes('css')) return 'css';
  return 'text';
};

export let formatTitleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
