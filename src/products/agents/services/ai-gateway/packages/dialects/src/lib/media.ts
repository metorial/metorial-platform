import type { LanguageModelV4FilePart, SharedV4ProviderOptions } from '@ai-sdk/provider';
import { invalidParam } from './errors';

let dataUrlPattern = /^data:([^;,]+)?((?:;[^;,]+)*?);base64,(.*)$/s;

export let parseDataUrl = (url: string) => {
  let match = dataUrlPattern.exec(url);
  if (!match) return null;

  return { mediaType: match[1] || 'application/octet-stream', data: match[3]! };
};

let parseHttpUrl = (url: string) => {
  try {
    let parsed = new URL(url);
    return parsed.protocol == 'http:' || parsed.protocol == 'https:' ? parsed : null;
  } catch {
    return null;
  }
};

// A remote URL stays a URL: the AI SDK passes it through to providers that fetch it themselves
// and only downloads it for providers that need inline bytes.
export let filePartFromUrl = (d: {
  url: string;
  path: string;
  fallbackMediaType: string;
  filename?: string;
  providerOptions?: SharedV4ProviderOptions;
}): LanguageModelV4FilePart => {
  let dataUrl = parseDataUrl(d.url);
  if (dataUrl) {
    return {
      type: 'file',
      mediaType: dataUrl.mediaType,
      data: { type: 'data', data: dataUrl.data },
      filename: d.filename,
      providerOptions: d.providerOptions
    };
  }

  let httpUrl = parseHttpUrl(d.url);
  if (!httpUrl) {
    throw invalidParam(d.path, `"${d.path}" must be an http(s) URL or a base64 data URL.`);
  }

  return {
    type: 'file',
    mediaType: d.fallbackMediaType,
    data: { type: 'url', url: httpUrl },
    filename: d.filename,
    providerOptions: d.providerOptions
  };
};

export let filePartFromBase64 = (d: {
  data: string;
  mediaType: string;
  filename?: string;
  providerOptions?: SharedV4ProviderOptions;
}): LanguageModelV4FilePart => ({
  type: 'file',
  mediaType: d.mediaType,
  data: { type: 'data', data: d.data },
  filename: d.filename,
  providerOptions: d.providerOptions
});
