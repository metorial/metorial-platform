import {
  extractPrices,
  modelId,
  priceCell,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  tokenCount,
  type PublishedPrice
} from '../pricing';

export let parseXai = (raw: unknown) =>
  extractPrices('xai', () => {
    let document = pricingDocument(raw, 'xai');
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

        if (h.includes('Input / 1M tokens')) {
          let label = cell('Model');
          let model = label.replace(/\s*\(.*$/, '');
          let input = priceCell(cell('Input / 1M tokens'));
          let output = priceCell(cell('Output / 1M tokens'));
          let cacheRead = priceCell(cell('Cached input / 1M tokens'));
          let threshold = label.match(/[≥>]\s*([\d,.]+[kKmM]?)/);
          if (threshold) {
            let base = data.find(price => price.model === model);
            if (!base) throw new Error(`${model}: missing base context price`);
            base.contextTiers = [
              {
                minInputTokens: tokenCount(threshold[1]!) + (label.includes('≥') ? 0 : 1),
                input,
                output,
                cacheRead
              }
            ];
          } else add(model, input, output, cacheRead);
        }
      }
    }
    return { ...requirePrices(data, 'xai'), issues };
  });
