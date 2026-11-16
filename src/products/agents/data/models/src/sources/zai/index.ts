import {
  extractPrices,
  modelId,
  priceCell,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

export let parseZai = (raw: unknown) =>
  extractPrices('zai', () => {
    let document = pricingDocument(raw, 'zai');
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

        if (h.includes('Cached Input') && h.includes('Input'))
          add(
            cell('Model').toLowerCase(),
            priceCell(cell('Input')),
            priceCell(cell('Output')),
            priceCell(cell('Cached Input')),
            { endpoint: 'intl' }
          );
      }
    }
    return { ...requirePrices(data, 'zai'), issues };
  });
