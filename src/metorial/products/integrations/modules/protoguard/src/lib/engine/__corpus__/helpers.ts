import { activeRuleset } from '../../../definitions/rulesets';
import { scanPayloadSync } from '../scan';
import type { EngineFinding, ScanContext, ScanPayload, ScanResult } from '../types';

export let tagify = (value: string) =>
  [...value].map(char => String.fromCodePoint(0xe0000 + char.charCodeAt(0))).join('');

export let toBase64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');

export let toHex = (value: string) => Buffer.from(value, 'utf8').toString('hex');

export let toPercent = (value: string) =>
  [...Buffer.from(value, 'utf8')]
    .map(byte => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

export let toUnicodeEscapes = (value: string) =>
  [...value].map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');

export let scan = (payload: ScanPayload, context?: ScanContext): ScanResult =>
  scanPayloadSync({ ruleset: activeRuleset, payload, context });

export let scanOutput = (output: unknown, context?: ScanContext) => scan({ output }, context);

export let familiesOf = (findings: EngineFinding[]) =>
  [...new Set(findings.map(finding => finding.family))].sort();

export let ruleKeysOf = (findings: EngineFinding[]) =>
  [...new Set(findings.map(finding => finding.ruleKey))].sort();

let PROSE = [
  'The quarterly report shows steady growth across all regions.',
  'Customers in the northern district renewed their contracts early.',
  'Our support team resolved most tickets within one business day.',
  'Shipping delays were caused by weather at the main distribution hub.',
  'The new onboarding flow reduced drop-off during account creation.',
  'Engineering migrated the billing service to the new cluster last week.',
  'Please review the attached spreadsheet before the planning meeting.',
  'Latency improved after the cache layer was moved closer to the database.'
];

export let benignProse = (chars: number, seed = 0) => {
  let parts: string[] = [];
  let length = 0;

  for (let index = seed; length < chars; index++) {
    let sentence = `${PROSE[index % PROSE.length]} Ref ${index}.`;
    parts.push(sentence);
    length += sentence.length + 1;
  }

  return parts.join(seed % 3 == 0 ? '\n' : ' ').slice(0, chars);
};

export let benignRecords = (chars: number, depth = 6) => {
  let records: unknown[] = [];
  let length = 0;

  for (let index = 0; length < chars; index++) {
    let body = benignProse(1800, index);

    let leaf: Record<string, unknown> = {
      note: `leaf ${index}`,
      body: benignProse(200, index)
    };
    for (let level = depth; level > 0; level--) leaf = { [`level${level}`]: leaf, level };

    records.push({
      id: `rec_${index.toString(36).padStart(8, '0')}`,
      title: `Record number ${index}`,
      body,
      meta: { tags: ['alpha', 'beta', `t${index % 17}`], nested: leaf }
    });
    length += body.length + 400;
  }

  return {
    content: [{ type: 'text', text: 'Search results' }],
    structuredContent: { records }
  };
};
