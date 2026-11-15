import { hmac128, type OrganizationKey } from '@mtsrc/agent-tracking-crypto';

let maxRootLength = 1024;

export let normalizeRoot = (raw: string | undefined) => {
  if (typeof raw != 'string') return undefined;

  let root = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/');

  if (/^[A-Za-z]:\//.test(root)) root = root[0]!.toLowerCase() + root.slice(1);
  if (root.length > 1) root = root.replace(/\/+$/, '');

  if (!root || root.length > maxRootLength) return undefined;

  return root;
};

// The same path on two devices is two checkouts, so the hash is scoped to the bound device, or to
// the credential when the device is only known later (ephemeral and vendor senders).
export let rootHash = (
  organizationKey: OrganizationKey,
  scope: string,
  normalizedRoot: string
) => hmac128(organizationKey, 'workspace-root', scope, normalizedRoot);
