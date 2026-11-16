import {
  amount,
  extractPrices,
  modelId,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  tokenCount,
  type PublishedPrice
} from '../pricing';

export let parsePerplexity = (raw: unknown) =>
  extractPrices('perplexity', () => {
    let document = pricingDocument(raw, 'perplexity');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let add = (
      model: string,
      input: number | null,
      output: number | null,
      cacheRead: number | null,
      extra: Partial<PublishedPrice> = {}
    ) => {
      let price: PublishedPrice = {
        model: modelId(model),
        modality: 'text',
        rates: publishedRates({ input, output, cacheRead }),
        contextTiers: null,
        ...extra
      };
      data.push(price);
      return price;
    };
    for (let table of pricingTables(document)) {
      let h = table.headers;
      for (let [index, row] of table.rows.entries()) {
        let cell = (header: string) => {
          let value = row[h.indexOf(header)];
          if (value === undefined) throw new Error(`missing ${header} column`);
          return value;
        };

        if (h.includes('Input ($/1M)')) {
          let parseRate = (value: string) => {
            let tier = value
              .replace(/\\/g, '')
              .match(/^([\d.]+) \([≤<]([\d.]+[kKmM]?)\) ([\d.]+) \(([>≥])([\d.]+[kKmM]?)\)$/);
            if (tier) {
              if (tokenCount(tier[2]!) !== tokenCount(tier[5]!))
                throw new Error('mismatched context thresholds');
              return {
                base: amount(tier[1]),
                high: amount(tier[3]),
                min: tokenCount(tier[2]!) + (tier[4] === '>' ? 1 : 0)
              };
            }
            return { base: amount(value), high: null, min: null };
          };
          let input = parseRate(cell('Input ($/1M)'));
          let output = parseRate(cell('Output ($/1M)'));
          let discount = cell('Cache read ($/1M)').match(/^(\d+)% off input$/);
          let cache = discount
            ? {
                base: input.base * (1 - amount(discount[1]) / 100),
                high:
                  input.high === null ? null : input.high * (1 - amount(discount[1]) / 100),
                min: input.min
              }
            : parseRate(cell('Cache read ($/1M)'));
          let p = add(cell('Model'), input.base, output.base, cache.base, {
            endpoint: 'agent'
          });
          if (input.min !== null)
            p.contextTiers = [
              {
                minInputTokens: input.min,
                input: input.high,
                output: output.high,
                cacheRead: cache.high
              }
            ];
        }
      }
    }
    return { ...requirePrices(data, 'perplexity'), issues };
  });
