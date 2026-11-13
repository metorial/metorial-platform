import type { SessionContextData } from '@mtsrc/agent-tracking-spec';
import type { ContentInput } from '@mtsrc/agent-tracking-content';
import { hmac128, type OrganizationKey } from '@mtsrc/agent-tracking-crypto';
import { normalizeRoot, rootHash } from './roots';

export let sessionContextType = 'session.context';

let stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  if (value && typeof value == 'object') {
    let entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
};

export let contextFingerprint = (value: unknown) => stableStringify(value);

// The working directory travels as a `path` content input, so the content policy decides whether
// its text is kept; the record itself only carries the keyed hash.
export let finishSessionContext = (d: {
  organizationKey: OrganizationKey;
  rootScope: string;
  sessionKey: string | undefined;
  content: ContentInput[] | undefined;
  data: Record<string, unknown>;
}): { data: SessionContextData; factKey: string | null } => {
  let data = { ...d.data } as SessionContextData;

  let pathInput = d.content?.find(input => input.role == 'path');
  let root = normalizeRoot(typeof pathInput?.value == 'string' ? pathInput.value : undefined);

  if (root) {
    data.workspace = {
      root_hash: rootHash(d.organizationKey, d.rootScope, root),
      ...(data.repo ? { label: data.repo.name } : {})
    };
  }

  let factKey = d.sessionKey
    ? `context:${d.sessionKey}:${hmac128(
        d.organizationKey,
        'session-context',
        stableStringify({ ...data, source: undefined })
      )}`
    : null;

  return { data, factKey };
};
