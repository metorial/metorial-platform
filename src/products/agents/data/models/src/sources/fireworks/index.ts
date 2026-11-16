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

export let parseFireworks = (raw: unknown) =>
  extractPrices('fireworks', () => {
    let document = pricingDocument(raw, 'fireworks');
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

        if (h.includes('Standard') && h.includes('Priority')) {
          let label = cell('Model');
          let link = table.rawRows[index]![h.indexOf('Model')]!.match(
            /https:\/\/app\.fireworks\.ai\/models\/fireworks\/([^)]+)/
          );
          if (!link) throw new Error(`${label}: missing API model link`);
          if (/\(US\)|Fast|Ultra-fast/.test(label)) {
            issues.push(`fireworks ${label}: separate regional/speed variant`);
            continue;
          }
          for (let tier of ['Standard', 'Priority']) {
            if (cell(tier) === '—') continue;
            let rates = cell(tier)
              .split(/\s+\/\s+/)
              .map(priceCell);
            if (rates.length !== 3)
              throw new Error(`${label}: expected input/cache/output prices`);
            add(
              `accounts/fireworks/models/${link[1]}`,
              rates[0]!,
              rates[2]!,
              rates[1]!,
              tier === 'Priority' ? { serving: 'priority' } : {}
            );
          }
        }
      }
    }
    return { ...requirePrices(data, 'fireworks'), issues };
  });
