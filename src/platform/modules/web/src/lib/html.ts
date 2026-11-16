import { Parser } from 'htmlparser2';
import {
  MAX_CANDIDATES_PER_PAGE,
  MAX_DESCRIPTION_LENGTH,
  MAX_HTML_NODES,
  MAX_JSON_LD_BYTES,
  MAX_JSON_LD_NODES,
  MAX_MANIFEST_ICONS,
  MAX_SHORT_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH
} from './limits';

export type CandidateSource = PrismaJson.WebImageCandidate['source'];

export type CandidateSeed = {
  url: string;
  source: CandidateSource;
  declaredWidth: number | null;
  declaredHeight: number | null;
};

export type ParsedWebPage = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  lang: string | null;
  themeColor: string | null;
  canonicalUrl: string | null;
  manifestUrl: string | null;
  candidates: CandidateSeed[];
};

let hiddenCharacters =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uFFFD]/g;
let languageTag = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,3}$/;
let hexColor = /^#[0-9a-fA-F]{3,8}$/;

export let cleanText = (value: unknown, maxLength: number) => {
  if (typeof value != 'string') return null;

  let text = value
    .replace(hiddenCharacters, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .replace(/[\uD800-\uDBFF]$/, '')
    .trim();

  return text || null;
};

export let resolveUrl = (
  raw: unknown,
  base: string,
  opts: { httpsOnly: boolean }
): string | null => {
  if (typeof raw != 'string') return null;

  let trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }

  if (url.protocol != 'https:' && (opts.httpsOnly || url.protocol != 'http:')) return null;
  if (url.username || url.password) return null;

  url.hash = '';

  let href = url.toString();
  return href.length > MAX_URL_LENGTH ? null : href;
};

export let parseSizes = (value: string | null | undefined) => {
  if (!value) return null;

  let best: { width: number; height: number } | null = null;

  for (let match of value.matchAll(/(\d{1,5})x(\d{1,5})/gi)) {
    let width = Number(match[1]);
    let height = Number(match[2]);

    if (!best || width * height > best.width * best.height) best = { width, height };
  }

  return best;
};

type Attributes = Record<string, string>;

let getAttr = (attributes: Attributes, name: string) =>
  Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : undefined;

let collectElements = (html: string) => {
  let found = {
    htmlLang: null as string | null,
    titleText: null as string | null,
    metas: [] as Attributes[],
    links: [] as Attributes[],
    jsonLd: [] as string[]
  };

  let visited = 0;
  let isDone = false;
  let titleBuffer: string | null = null;
  let jsonLdBuffer: string | null = null;

  let parser = new Parser(
    {
      onopentag(name, attributes) {
        if (isDone) return;

        visited++;
        if (visited > MAX_HTML_NODES || name == 'body') {
          isDone = true;
          return;
        }

        if (name == 'html') found.htmlLang = getAttr(attributes, 'lang') ?? null;
        if (name == 'meta') found.metas.push(attributes);
        if (name == 'link') found.links.push(attributes);
        if (name == 'title' && found.titleText === null) titleBuffer = '';

        if (
          name == 'script' &&
          getAttr(attributes, 'type')?.trim().toLowerCase() == 'application/ld+json'
        ) {
          jsonLdBuffer = '';
        }
      },

      ontext(text) {
        if (isDone) return;

        if (titleBuffer !== null && titleBuffer.length < MAX_TITLE_LENGTH * 4) {
          titleBuffer += text;
        }
        if (jsonLdBuffer !== null && jsonLdBuffer.length <= MAX_JSON_LD_BYTES) {
          jsonLdBuffer += text;
        }
      },

      onclosetag(name) {
        if (isDone) return;

        if (name == 'title' && titleBuffer !== null) {
          found.titleText = titleBuffer;
          titleBuffer = null;
        }

        if (name == 'script' && jsonLdBuffer !== null) {
          if (jsonLdBuffer.length <= MAX_JSON_LD_BYTES) found.jsonLd.push(jsonLdBuffer);
          jsonLdBuffer = null;
        }

        if (name == 'head') isDone = true;
      }
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true }
  );

  parser.write(html);
  parser.end();

  return found;
};

let extractJsonLdLogos = (documents: string[]) => {
  let logos: string[] = [];
  let visited = 0;

  for (let text of documents) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }

    let stack: unknown[] = [parsed];

    while (stack.length && visited < MAX_JSON_LD_NODES) {
      let node = stack.pop();
      visited++;

      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      if (!node || typeof node != 'object') continue;

      for (let [key, value] of Object.entries(node)) {
        if (key == 'logo') {
          for (let entry of Array.isArray(value) ? value : [value]) {
            if (typeof entry == 'string') logos.push(entry);
            else if (entry && typeof entry == 'object') {
              let url = (entry as any).url ?? (entry as any).contentUrl;
              if (typeof url == 'string') logos.push(url);
            }
          }
        } else if (value && typeof value == 'object') {
          stack.push(value);
        }
      }
    }
  }

  return logos;
};

export let parseWebPage = (html: string, pageUrl: string): ParsedWebPage => {
  let found = collectElements(html);

  let meta = new Map<string, string>();
  for (let attributes of found.metas) {
    let key = (getAttr(attributes, 'property') ?? getAttr(attributes, 'name'))
      ?.trim()
      .toLowerCase();
    let content = getAttr(attributes, 'content');

    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }

  let candidates: CandidateSeed[] = [];
  let addCandidate = (
    raw: unknown,
    source: CandidateSource,
    declared?: { width: number; height: number } | null
  ) => {
    let url = resolveUrl(raw, pageUrl, { httpsOnly: true });
    if (!url || candidates.some(c => c.url == url)) return;

    candidates.push({
      url,
      source,
      declaredWidth: declared?.width ?? null,
      declaredHeight: declared?.height ?? null
    });
  };

  let manifestUrl: string | null = null;
  let canonicalRaw: string | undefined;

  for (let link of found.links) {
    let rels = (getAttr(link, 'rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    let href = getAttr(link, 'href');
    if (!href) continue;

    let sizes = parseSizes(getAttr(link, 'sizes'));
    let type = (getAttr(link, 'type') ?? '').toLowerCase();

    if (rels.includes('manifest') && !manifestUrl) {
      manifestUrl = resolveUrl(href, pageUrl, { httpsOnly: false });
    } else if (rels.includes('canonical') && !canonicalRaw) {
      canonicalRaw = href;
    } else if (
      rels.includes('apple-touch-icon') ||
      rels.includes('apple-touch-icon-precomposed')
    ) {
      addCandidate(href, 'apple_touch_icon', sizes);
    } else if (rels.includes('mask-icon')) {
      addCandidate(href, 'mask_icon');
    } else if (rels.includes('icon')) {
      let isSvg = type.includes('svg') || /\.svg(\?|$)/i.test(href);
      addCandidate(href, isSvg ? 'svg_icon' : 'icon', sizes);
    }
  }

  for (let logo of extractJsonLdLogos(found.jsonLd)) addCandidate(logo, 'jsonld_logo');

  let ogSize =
    Number(meta.get('og:image:width')) > 0 && Number(meta.get('og:image:height')) > 0
      ? {
          width: Number(meta.get('og:image:width')),
          height: Number(meta.get('og:image:height'))
        }
      : null;
  for (let key of ['og:image', 'og:image:secure_url', 'og:image:url']) {
    addCandidate(meta.get(key), 'og_image', ogSize);
  }
  for (let key of ['twitter:image', 'twitter:image:src']) {
    addCandidate(meta.get(key), 'twitter_image');
  }

  let lang = cleanText(found.htmlLang ?? meta.get('og:locale'), 35)?.replace(/_/g, '-');
  let themeColor = meta.get('theme-color')?.trim();

  return {
    title: cleanText(
      meta.get('og:title') ?? meta.get('twitter:title') ?? found.titleText,
      MAX_TITLE_LENGTH
    ),
    description: cleanText(
      meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'),
      MAX_DESCRIPTION_LENGTH
    ),
    siteName: cleanText(
      meta.get('og:site_name') ??
        meta.get('application-name') ??
        meta.get('apple-mobile-web-app-title'),
      MAX_SHORT_TEXT_LENGTH
    ),
    lang: lang && languageTag.test(lang) ? lang : null,
    themeColor: themeColor && hexColor.test(themeColor) ? themeColor : null,
    canonicalUrl: resolveUrl(canonicalRaw, pageUrl, { httpsOnly: false }),
    manifestUrl,
    candidates: candidates.slice(0, MAX_CANDIDATES_PER_PAGE)
  };
};

export let parseManifestIcons = (json: string, manifestUrl: string): CandidateSeed[] => {
  let manifest: unknown;
  try {
    manifest = JSON.parse(json);
  } catch {
    return [];
  }

  let icons = (manifest as any)?.icons;
  if (!Array.isArray(icons)) return [];

  let seeds: CandidateSeed[] = [];

  for (let icon of icons.slice(0, MAX_MANIFEST_ICONS)) {
    if (!icon || typeof icon != 'object') continue;

    let url = resolveUrl(icon.src, manifestUrl, { httpsOnly: true });
    if (!url || seeds.some(s => s.url == url)) continue;

    let sizes = parseSizes(typeof icon.sizes == 'string' ? icon.sizes : null);

    seeds.push({
      url,
      source: 'manifest_icon',
      declaredWidth: sizes?.width ?? null,
      declaredHeight: sizes?.height ?? null
    });
  }

  return seeds;
};
