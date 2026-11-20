export let TRUST_KEYS_FILE = 'keys.json';

export type KeySet = { keys: Record<string, string> };

export type PublishedKey = { kid: string; publicKey: string };

export let signerFile = (signer: string) => `signer-${signer}.json`;

export let parseKeySet = (raw: string | undefined): KeySet => {
  if (!raw) return { keys: {} };

  try {
    let parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.keys != 'object' || Array.isArray(parsed.keys))
      return { keys: {} };

    let keys: Record<string, string> = {};
    for (let [kid, publicKey] of Object.entries(parsed.keys)) {
      if (kid && typeof publicKey == 'string') keys[kid] = publicKey;
    }
    return { keys };
  } catch {
    return { keys: {} };
  }
};

let encode = (set: KeySet) =>
  JSON.stringify({ keys: Object.fromEntries(Object.entries(set.keys).sort()) });

// Each signer owns only the keys it published itself, recorded in its own signer file. The merged
// keys.json drops the signer's previous keys and adds its current one; keys of other signers, of the
// legacy install Job and of an operator rotating by hand are left alone.
export let mergeSignerKey = (
  data: Record<string, string> | undefined,
  signer: string,
  key: PublishedKey
) => {
  let current = parseKeySet(data?.[TRUST_KEYS_FILE]);
  let previous = parseKeySet(data?.[signerFile(signer)]);

  let keys = { ...current.keys };
  for (let kid of Object.keys(previous.keys)) delete keys[kid];
  keys[key.kid] = key.publicKey;

  let next = {
    ...data,
    [TRUST_KEYS_FILE]: encode({ keys }),
    [signerFile(signer)]: encode({ keys: { [key.kid]: key.publicKey } })
  };

  let changed =
    next[TRUST_KEYS_FILE] != data?.[TRUST_KEYS_FILE] ||
    next[signerFile(signer)] != data?.[signerFile(signer)];

  return { data: next, changed };
};
