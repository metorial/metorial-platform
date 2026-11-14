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

export let parseTogether = (raw: unknown) =>
  extractPrices('together', () => {
    let document = pricingDocument(raw, 'together');
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
        if (
          h.includes('API model string') &&
          h.some(name => name.startsWith('Input pricing'))
        ) {
          let rate = (prefix: string) => {
            let column = h.find(name => name.startsWith(prefix));
            return column ? priceCell(cell(column)) : null;
          };
          let existing = data.find(price => price.model === cell('API model string'));
          if (existing) {
            if (
              rate('Input pricing') !== existing.rates.input ||
              rate('Output pricing') !== existing.rates.output
            )
              throw new Error(`${existing.model}: conflicting model prices across tables`);
            continue;
          }
          add(
            cell('API model string'),
            rate('Input pricing'),
            rate('Output pricing'),
            rate('Cached input pricing')
          );
        }
      }
    }
    return { ...requirePrices(data, 'together'), issues };
  });
