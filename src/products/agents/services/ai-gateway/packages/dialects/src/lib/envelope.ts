import type { SharedV4ProviderMetadata, SharedV4ProviderOptions } from '@ai-sdk/provider';

let prefix = 'mgw1.';

let isNonEmpty = (
  metadata: SharedV4ProviderMetadata | undefined
): metadata is SharedV4ProviderMetadata =>
  !!metadata && Object.values(metadata).some(value => value && Object.keys(value).length);

// Reasoning (and the signatures that let a provider verify it) only round-trips if the client
// hands it back verbatim. Dialect fields meant for one vendor's opaque blob (Anthropic's
// `signature`, OpenAI's `encrypted_content`) carry the full AI SDK provider metadata instead, so a
// conversation can move between providers. The prefix contains a dot, which never appears in
// vendor blobs (base64), so native values are told apart from ours.
export let encodeProviderMetadata = (metadata: SharedV4ProviderMetadata | undefined) =>
  isNonEmpty(metadata)
    ? prefix + Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64url')
    : undefined;

export let decodeProviderMetadata = (value: string): SharedV4ProviderOptions | null => {
  if (!value.startsWith(prefix)) return null;

  try {
    let decoded = JSON.parse(
      Buffer.from(value.slice(prefix.length), 'base64url').toString('utf8')
    );
    return decoded && typeof decoded == 'object' && !Array.isArray(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

export let mergeProviderMetadata = (
  current: SharedV4ProviderMetadata | undefined,
  next: SharedV4ProviderMetadata | undefined
): SharedV4ProviderMetadata | undefined => {
  if (!next) return current;
  if (!current) return next;

  let merged: SharedV4ProviderMetadata = { ...current };
  for (let [key, value] of Object.entries(next)) merged[key] = { ...merged[key], ...value };

  return merged;
};

let onlyKeys = (metadata: SharedV4ProviderMetadata, namespaces: string[], fields: string[]) =>
  Object.entries(metadata).every(
    ([namespace, value]) =>
      !Object.keys(value).length ||
      (namespaces.includes(namespace) &&
        Object.keys(value).every(field => fields.includes(field)))
  );

// Anthropic clients expect a real Anthropic signature; we only fall back to the envelope when the
// reasoning carries metadata from somewhere else.
export let anthropicSignatureFor = (metadata: SharedV4ProviderMetadata | undefined) => {
  if (!isNonEmpty(metadata)) return '';

  let signature = metadata.anthropic?.signature;
  if (typeof signature == 'string' && onlyKeys(metadata, ['anthropic'], ['signature'])) {
    return signature;
  }

  return encodeProviderMetadata(metadata)!;
};

export let anthropicRedactedData = (metadata: SharedV4ProviderMetadata | undefined) => {
  let data = metadata?.anthropic?.redactedData;
  return typeof data == 'string' ? data : null;
};

export let openaiEncryptedContentFor = (metadata: SharedV4ProviderMetadata | undefined) => {
  if (!isNonEmpty(metadata)) return null;

  let native =
    metadata.openai?.reasoningEncryptedContent ?? metadata.azure?.reasoningEncryptedContent;
  if (
    typeof native == 'string' &&
    onlyKeys(metadata, ['openai', 'azure'], ['itemId', 'reasoningEncryptedContent'])
  ) {
    return native;
  }

  return encodeProviderMetadata(metadata)!;
};

export let reasoningOptionsFromSignature = (
  signature: string | undefined | null,
  native: (value: string) => SharedV4ProviderOptions
): SharedV4ProviderOptions | undefined => {
  if (!signature) return undefined;
  return decodeProviderMetadata(signature) ?? native(signature);
};
