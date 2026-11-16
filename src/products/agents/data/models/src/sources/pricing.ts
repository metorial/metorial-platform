import { v } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';
import type { ContextTier, TokenRates } from '../types';
import { extractData, ExtractionError } from '../lib/extraction';
import { normalizeKey } from '../normalize/parseName';

let maxDocumentLength = 2_000_000;

let documentSchema = v.createValidator<string, {}>('pricing_document', (_opts, value) =>
  typeof value === 'string' && value.length <= maxDocumentLength
    ? { success: true, value }
    : v.error([
        { code: 'invalid_pricing_document', message: 'Expected a bounded pricing document' }
      ])
)();

export interface PublishedPrice {
  model: string;
  modality: 'text' | 'image' | 'audio' | 'video';
  rates: TokenRates;
  contextTiers: ContextTier[] | null;
  endpoint?: string;
  serving?: string;
  units?: import('../types').UnitPrice[];
  conditions?: { label: string; description: string; rates: TokenRates }[];
  validUntil?: string;
}

export let pricingDocument = (raw: unknown, source: string) =>
  parseWith(documentSchema, raw, `${source} pricing document`);

export let cleanCell = (cell: string) =>
  cell
    .replace(/<sup>.*?<\/sup>/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\\([$|])/g, '$1')
    .trim();

export let priceCell = (cell: string | undefined): number | null => {
  if (cell === undefined) throw new Error('missing price column');

  let value = cleanCell(cell);
  if (/^(?:-|—|N\/A|\\+)$/i.test(value)) return null;
  if (/^(?:Free|Free of charge|Limited-time Free)$/i.test(value)) return 0;
  if (!/^\$\d[\d,]*(?:\.\d+)?(?:\s*\/\s*MTok)?$/.test(value))
    throw new Error(`unsupported token price: ${value}`);

  let amount = Number(value.replace(/[$,]/g, '').split(/\s*\//)[0]);
  if (!Number.isFinite(amount)) throw new Error(`invalid token price: ${value}`);
  return amount;
};

export let pricingTables = (document: string) => {
  let tables: { headers: string[]; rows: string[][]; rawRows: string[][]; before: string }[] =
    [];
  let lines = document.split('\n').map(line => line.replace(/^(?:\s*>)+\s?/, ''));

  for (let index = 0; index < lines.length - 1; index++) {
    let line = lines[index]!.trim();
    if (!line.startsWith('|') || !/^\|\s*:?-+/.test(lines[index + 1]!.trim())) continue;

    let rawCells = (row: string) =>
      row
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|');

    let table = {
      headers: rawCells(line).map(cleanCell),
      rows: [] as string[][],
      rawRows: [] as string[][],
      before: lines.slice(0, index).join('\n')
    };

    index += 2;
    while (index < lines.length && lines[index]!.trim().startsWith('|')) {
      let cells = rawCells(lines[index]!);
      if (cells.length !== table.headers.length)
        throw new Error('pricing table column count changed');
      table.rawRows.push(cells);
      table.rows.push(cells.map(cleanCell));
      index++;
    }

    tables.push(table);
  }

  return tables;
};

export let publishedRates = (d: {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite?: TokenRates['cacheWrite'];
}): TokenRates => ({ ...d, cacheWrite: d.cacheWrite ?? [], reasoning: null });

export let amount = (value: unknown, scale = 1): number => {
  let parsed = parseWith(v.union([v.string(), v.number()]), value, 'price');
  if (typeof parsed === 'string' && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(parsed))
    throw new Error(`invalid numeric price: ${parsed}`);

  let number = Number(parsed) * scale;
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`invalid numeric price: ${parsed}`);
  return Math.round(number * 1e9) / 1e9;
};

export let jsonObject = (raw: unknown, label: string) =>
  parseWith(v.record(v.any()), raw, label);

export let jsonArray = (raw: unknown, label: string) =>
  parseWith(v.array(v.any()), raw, label);

export let modelId = (raw: unknown) => {
  let id = parseWith(v.string(), raw, 'model id').trim();
  if (!id || /\s/.test(id)) throw new Error(`invalid model id: ${id}`);
  return id;
};

export let requirePrices = (data: PublishedPrice[], source: string) =>
  extractData<PublishedPrice>(source, extraction => {
    let seen = new Map<string, PublishedPrice>();

    for (let price of data)
      extraction.row(price.model, () => {
        modelId(price.model);
        if (!['text', 'image', 'audio', 'video'].includes(price.modality))
          throw new Error('invalid price modality');
        if (
          price.rates.input === null &&
          price.rates.output === null &&
          !price.units?.length &&
          !price.conditions?.length
        )
          throw new Error('price record contains no billable rates');

        for (let rate of [
          price.rates,
          ...(price.conditions ?? []).map(condition => condition.rates)
        ]) {
          for (let value of [
            rate.input,
            rate.output,
            rate.cacheRead,
            rate.reasoning,
            ...rate.cacheWrite.map(write => write.price)
          ])
            if (value !== null) amount(value);
        }
        for (let unit of price.units ?? []) {
          if (!unit.unit || !['input', 'output'].includes(unit.direction))
            throw new Error('invalid billing unit');
          amount(unit.price);
        }
        let previousThreshold = 0;
        for (let tier of price.contextTiers ?? []) {
          if (
            !Number.isInteger(tier.minInputTokens) ||
            tier.minInputTokens <= previousThreshold
          )
            throw new Error('invalid context threshold');
          previousThreshold = tier.minInputTokens;
          for (let value of [tier.input, tier.output, tier.cacheRead])
            if (value !== null) amount(value);
        }

        let key = `${normalizeKey(price.model)}:${price.modality}:${price.endpoint ?? ''}:${price.serving ?? ''}`;
        let previous = seen.get(key);
        if (previous && JSON.stringify(previous) !== JSON.stringify(price))
          throw new Error(`conflicting duplicate price for ${key}`);
        if (!previous) {
          seen.set(key, price);
          extraction.add(price);
        }
      });
  });

export let extractPrices = (source: string, run: () => ReturnType<typeof requirePrices>) => {
  try {
    return run();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    return extractData<PublishedPrice>(source, d => d.abort((error as Error).message));
  }
};

export let tokenCount = (value: string) => {
  let match = value.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!match) throw new Error(`invalid token threshold: ${value}`);
  return amount(match[1], { k: 1000, m: 1e6 }[match[2]!.toLowerCase()] ?? 1);
};
