import { createHmac } from 'node:crypto';
import { formatPath, OBJECT_KEY_PATH_MARKER } from './segment';
import type { EngineFinding, RuleStage, ScanDirection, ScanView } from './types';

export type RetentionLevel = 'full' | 'intent_only' | 'none';

let SNIPPET_MAX_CHARS = 500;
let SNIPPET_CONTEXT_CHARS = 120;
let DECODED_SAMPLE_MAX_CHARS = 200;
let REDACTED_PATH_KEY = '*';
let SECRET_MASK = '[REDACTED]';
let CONTEXT_TOKEN_MIN_CHARS = 32;

// Keys that belong to the MCP envelope rather than to tool arguments or results. Anything else in a
// path may be a user-chosen field name, so below full retention it is replaced with "*".
let MCP_PATH_KEYS = new Set([
  'input',
  'output',
  'tool_definition',
  'arguments',
  'params',
  'result',
  'content',
  'structuredContent',
  'text',
  'type',
  'resource',
  'uri',
  'mimeType',
  'name',
  'title',
  'description',
  'inputSchema',
  'outputSchema',
  'properties',
  'annotations',
  'isError',
  'messages',
  'role',
  'data',
  'blob',
  '_meta',
  OBJECT_KEY_PATH_MARKER
]);

let SECRET_PATTERNS = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----[\s\S]{0,8192}?(?:-----END [A-Z ]{0,40}-----|$)/g,
  /\beyJ[A-Za-z0-9_-]{10,4096}\.eyJ[A-Za-z0-9_-]{10,8192}\.[A-Za-z0-9_-]{10,1024}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,255}/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{20,255}/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,255}/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,255}/g
];

export interface ProjectedFinding {
  ruleKey: string;
  family: string;
  stage: RuleStage;
  direction: ScanDirection;
  view: ScanView;
  precision: number;
  hardRule: boolean;
  description: string;
  path: string;
  redactedPath: string;
  startOffset: number;
  endOffset: number;
  matchedText: string | null;
  sampleMarkdown: string | null;
  decodedSample: string | null;
  contentHmac: string | null;
}

export let maskSecrets = (value: string) =>
  SECRET_PATTERNS.reduce((masked, pattern) => masked.replace(pattern, SECRET_MASK), value);

let ORPHANED_PEM_LINE = /-----(?:BEGIN|END) [A-Z ]{0,40}-----/g;
let LONG_TOKEN = new RegExp(`[A-Za-z0-9+/=_-]{${CONTEXT_TOKEN_MIN_CHARS},}`, 'g');

// Context is cut at a fixed width during the scan, so a key body can arrive without the header or
// prefix SECRET_PATTERNS anchor on. Any long token-shaped run that contains a digit is masked too.
let maskContext = (value: string) =>
  maskSecrets(value)
    .replace(ORPHANED_PEM_LINE, SECRET_MASK)
    .replace(LONG_TOKEN, token => (/[0-9]/.test(token) ? SECRET_MASK : token));

let escapeMarkdownHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let buildSnippet = (finding: EngineFinding) => {
  let match = finding.redactMatch ? SECRET_MASK : maskSecrets(finding.matchedText);
  let room = Math.max(0, SNIPPET_MAX_CHARS - match.length);
  let side = Math.min(SNIPPET_CONTEXT_CHARS, Math.floor(room / 2));

  let before = side ? maskContext(finding.contextBefore).slice(-side) : '';
  let after = side ? maskContext(finding.contextAfter).slice(0, side) : '';

  return {
    matchedText: match.slice(0, SNIPPET_MAX_CHARS),
    markdown: `${escapeMarkdownHtml(before)}<mark>${escapeMarkdownHtml(match.slice(0, SNIPPET_MAX_CHARS))}</mark>${escapeMarkdownHtml(after)}`
  };
};

export let createContentHmac = (key: string, canonicalText: string) =>
  createHmac('sha256', key).update(canonicalText).digest('hex');

// The only way engine output reaches storage. Below full retention nothing derived from message
// content survives except offsets, rule identity, and a keyed hash that cannot be reversed without
// the tenant's key.
export let projectFinding = (
  finding: EngineFinding,
  level: RetentionLevel,
  d: { hmacKey: string | null }
): ProjectedFinding => {
  let isFull = level == 'full';

  let redactedPath = formatPath(finding.path, key =>
    MCP_PATH_KEYS.has(key) ? key : REDACTED_PATH_KEY
  );
  let path = isFull ? formatPath(finding.path) : redactedPath;
  let snippet = isFull ? buildSnippet(finding) : null;
  let decodedSample =
    isFull && finding.decodedSample && !finding.redactMatch
      ? maskSecrets(finding.decodedSample).slice(0, DECODED_SAMPLE_MAX_CHARS)
      : null;

  return {
    ruleKey: finding.ruleKey,
    family: finding.family,
    stage: finding.stage,
    direction: finding.direction,
    view: finding.view,
    precision: finding.precision,
    hardRule: finding.hardRule,
    description: isFull ? finding.description : finding.ruleDescription,
    path,
    redactedPath,
    startOffset: finding.startOffset,
    endOffset: finding.endOffset,
    matchedText: snippet?.matchedText ?? null,
    sampleMarkdown: snippet ? `**${escapeMarkdownHtml(path)}**\n\n${snippet.markdown}` : null,
    decodedSample,
    contentHmac: d.hmacKey ? createContentHmac(d.hmacKey, finding.canonicalText) : null
  };
};
