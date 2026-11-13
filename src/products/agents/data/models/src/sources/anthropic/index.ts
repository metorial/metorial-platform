import { fetchText, loadSource, type LoadSourceOptions } from '../fetch';
import {
  extractPrices,
  priceCell,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

let pricingUrl = 'https://platform.claude.com/docs/en/about-claude/pricing.md';

let parseAnthropicDocument = (raw: unknown) => {
  let document = pricingDocument(raw, 'anthropic');
  let data: PublishedPrice[] = [];

  for (let table of pricingTables(document)) {
    if (!table.headers.includes('Base input tokens')) continue;

    for (let row of table.rows) {
      let cell = (name: string) => row[table.headers.indexOf(name)];
      let label = cell('Model')!;
      let model = label
        .replace(/\s*\(.*$/, '')
        .toLowerCase()
        .replace(/\s+/g, '-');
      let rates = publishedRates({
        input: priceCell(cell('Base input tokens')),
        output: priceCell(cell('Output tokens')),
        cacheRead: priceCell(cell('Cache hits and refreshes')),
        cacheWrite: ['5m', '1h'].flatMap(ttl => {
          let price = priceCell(cell(`${ttl} cache writes`));
          return price === null ? [] : [{ ttl, price }];
        })
      });

      let threshold = label.match(/for prompts over ([\d,]+) tokens/);
      if (threshold) {
        let base = data.find(price => price.model === model);
        if (!base) throw new Error(`anthropic: missing base price for ${model}`);
        base.contextTiers = [
          {
            minInputTokens: Number(threshold[1]!.replace(/,/g, '')) + 1,
            input: rates.input,
            output: rates.output,
            cacheRead: rates.cacheRead
          }
        ];
      } else {
        data.push({ model, modality: 'text', rates, contextTiers: null });
      }
    }
  }

  return requirePrices(data, 'anthropic');
};

export let parseAnthropic = (raw: unknown) =>
  extractPrices('anthropic', () => parseAnthropicDocument(raw));

export let loadAnthropic = (
  opts: Omit<LoadSourceOptions<PublishedPrice[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'anthropic',
    ref: pricingUrl,
    fetch: () => fetchText(pricingUrl),
    parse: parseAnthropic
  });
