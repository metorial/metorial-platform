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

let pricingUrl = 'https://developers.openai.com/api/docs/pricing.md';

let parseOpenAiDocument = (raw: unknown) => {
  let document = pricingDocument(raw, 'openai');
  let data: PublishedPrice[] = [];

  for (let table of pricingTables(document)) {
    let { headers, before } = table;
    if (!headers.includes('Model') || headers.includes('Training')) continue;

    let section = before.match(/^### (.+)$/gm)?.at(-1) ?? '';
    let standard = section === '### Standard pricing data';
    let multimodal = headers.includes('Modality');
    let mode = before
      .match(/^(Standard|Batch|Flex|Fast|Ultrafast|Realtime & Audio)\s*$/gm)
      ?.at(-1)
      ?.trim();
    if (!standard && !(multimodal && (mode === 'Standard' || mode === 'Realtime & Audio')))
      continue;

    for (let row of table.rows) {
      let cell = (name: string) => row[headers.indexOf(name)];
      let model = cell('Model')!.replace(/\s*\(.*\)$/, '');
      let modality = multimodal ? cell('Modality')!.toLowerCase() : 'text';
      if (!['text', 'image', 'audio', 'video'].includes(modality)) continue;

      // Character-priced speech models are not token rates.
      if (row.some(value => /characters/.test(value))) continue;

      let prefix = headers.includes('Short context input') ? 'Short context ' : '';
      let column = (name: string) => (prefix ? `${prefix}${name.toLowerCase()}` : name);
      let rates = publishedRates({
        input: priceCell(cell(column('Input'))),
        output: priceCell(cell(column('Output'))),
        cacheRead: priceCell(cell(column('Cached input'))),
        cacheWrite: ['30m', '12h'].flatMap(ttl => {
          let column = `${prefix}${ttl} write`;
          let price = headers.includes(column) ? priceCell(cell(column)) : null;
          return price === null ? [] : [{ ttl, price }];
        })
      });

      let threshold = document.match(/Long context:\s*>\s*([\d,.]+)([KM]?) input tokens/i);
      if (prefix && !threshold) throw new Error('openai: missing long context threshold');

      let minInputTokens = threshold
        ? Number(threshold[1]!.replace(/,/g, '')) *
            ({ k: 1000, m: 1000000 }[threshold[2]!.toLowerCase()] ?? 1) +
          1
        : 0;
      let contextTiers = headers.includes('Long context input')
        ? [
            {
              minInputTokens,
              input: priceCell(cell('Long context input')),
              output: priceCell(cell('Long context output')),
              cacheRead: priceCell(cell('Long context cached input'))
            }
          ]
        : null;
      data.push({
        model,
        modality: modality as PublishedPrice['modality'],
        rates,
        contextTiers
      });
    }
  }

  return requirePrices(data, 'openai');
};

export let parseOpenAi = (raw: unknown) =>
  extractPrices('openai', () => parseOpenAiDocument(raw));

export let loadOpenAi = (
  opts: Omit<LoadSourceOptions<PublishedPrice[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'openai',
    ref: pricingUrl,
    fetch: () => fetchText(pricingUrl),
    parse: parseOpenAi
  });
