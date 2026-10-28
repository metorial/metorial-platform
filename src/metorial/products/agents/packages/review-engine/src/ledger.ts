export type LedgerRef =
  | { type: 'file'; path: string; lines?: number[] }
  | { type: 'url'; url: string }
  | { type: 'tool'; key: string }
  | { type: 'fact'; id: string };

export type LedgerFact = {
  id: string;
  title: string;
  detail: string;
};

let normalizeUrl = (url: string) => {
  try {
    let parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
};

let normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

export class EvidenceLedger {
  private files = new Map<string, number>();
  private urls = new Map<string, { snapshotHash: string; fetchedAt: string }>();
  private tools = new Set<string>();
  private facts = new Map<string, LedgerFact>();

  addFile(path: string, content: string) {
    this.files.set(normalizePath(path), content.split('\n').length);
  }

  addUrl(url: string, snapshotHash: string) {
    this.urls.set(normalizeUrl(url), { snapshotHash, fetchedAt: new Date().toISOString() });
  }

  addTool(key: string) {
    this.tools.add(key);
  }

  addFact(fact: LedgerFact) {
    this.facts.set(fact.id, fact);
  }

  getFacts() {
    return [...this.facts.values()];
  }

  getToolKeys() {
    return [...this.tools];
  }

  getUrls() {
    return [...this.urls.entries()].map(([url, value]) => ({ url, ...value }));
  }

  check(ref: LedgerRef): string | null {
    if (ref.type == 'file') {
      let lineCount = this.files.get(normalizePath(ref.path));
      if (lineCount === undefined) return `file "${ref.path}" is not part of the evidence`;

      if (ref.lines) {
        let [start, end] = ref.lines;
        if (ref.lines.length != 2 || start === undefined || end === undefined) {
          return `lines must be a [start, end] pair`;
        }
        if (start < 1 || end < start || end > lineCount) {
          return `lines ${start}-${end} are out of range for "${ref.path}" (${lineCount} lines)`;
        }
      }

      return null;
    }

    if (ref.type == 'url') {
      return this.urls.has(normalizeUrl(ref.url))
        ? null
        : `url "${ref.url}" was not fetched during this review`;
    }

    if (ref.type == 'tool') {
      return this.tools.has(ref.key) ? null : `tool "${ref.key}" is not in the specification`;
    }

    return this.facts.has(ref.id) ? null : `fact "${ref.id}" does not exist`;
  }

  toJSON() {
    return {
      files: Object.fromEntries(this.files),
      urls: Object.fromEntries(this.urls),
      tools: [...this.tools],
      facts: [...this.facts.values()]
    };
  }
}
