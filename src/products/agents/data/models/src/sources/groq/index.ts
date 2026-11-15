import {
  amount,
  extractPrices,
  modelId,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

export let parseGroq = (raw: unknown) =>
  extractPrices('groq', () => {
    let document = pricingDocument(raw, 'groq');
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

        if (h.includes('PRICE PER 1M TOKENS')) {
          let label = table.rawRows[index]![h.indexOf('MODEL ID')]!;
          let id = label.match(/\/docs\/model\/([^)]*)\)/)?.[1];
          if (!id) throw new Error('groq: missing model API id');
          let value = cell('PRICE PER 1M TOKENS');
          if (value.replace(/\s/g, '') === 'ContactSales') {
            issues.push(`groq ${id}: negotiated price`);
            continue;
          }
          let tokenPrices = value.match(/^\$([\d.]+) input\s*\$([\d.]+) output$/);
          if (tokenPrices) add(id, amount(tokenPrices[1]), amount(tokenPrices[2]), null);
          else {
            let unit = value.match(/^\$([\d.]+) per (hour|1M characters)$/);
            if (!unit) throw new Error(`${id}: unrecognized Groq price ${value}`);
            add(id, null, null, null, {
              modality: 'audio',
              units: [
                {
                  modality: unit[2] === 'hour' ? 'audio' : 'text',
                  direction: 'input',
                  unit: unit[2] === 'hour' ? 'hour' : 'character',
                  price: amount(unit[1], unit[2] === 'hour' ? 1 : 1e-6)
                }
              ]
            });
          }
        }
      }
    }
    return { ...requirePrices(data, 'groq'), issues };
  });
