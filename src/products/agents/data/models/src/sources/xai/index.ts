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

    let standardRows = 0;
    for (let table of pricingTables(document)) {
      let h = table.headers;
      let cell = (row: string[], header: string) => {
        let value = row[h.indexOf(header)];
        if (value === undefined) throw new Error(`missing ${header} column`);
        return value;
      };

      // Per-model rate tables without a Model column are the "Grok N Fast"
      // variant tables, which are only served through Cursor and Grok Build.
      if (h.includes('Prompt tokens') && h.includes('Cached input') && h.includes('Output')) {
        let heading = [...table.before.matchAll(/^#{1,6} +(.+)$/gm)].at(-1);
        let title = heading?.[1] ?? '';
        let section = heading ? table.before.slice(heading.index!) : table.before;
        if (!/Cursor and Grok Build only|not available on the public xAI API/.test(section))
          throw new Error(`unsupported per-model rate table: ${title || 'untitled section'}`);
        issues.push(
          `xai: ${title.replace(/\s*\(.*\)$/, '')} is excluded (Cursor and Grok Build only, not available on the public xAI API)`
        );
        continue;
      }

      if (!h.includes('Input / 1M tokens')) continue;
      for (let row of table.rows) {
        let label = cell(row, 'Model');
        let model = label.replace(/\s*\(.*$/, '');
        let input = priceCell(cell(row, 'Input / 1M tokens'));
        let output = priceCell(cell(row, 'Output / 1M tokens'));
        let cacheRead = priceCell(cell(row, 'Cached input / 1M tokens'));
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
        } else {
          add(model, input, output, cacheRead);
          standardRows++;
        }
      }
    }

    // The pricing page now loads the per-model tables from the models page; when
    // that content is missing it still publishes the US regional endpoint rates.
    if (!standardRows && /^\*Error loading model pricing\*$/m.test(document))
      issues.push(
        'xai: model pricing table unavailable on the pricing page; per-model details are published on the models page'
      );

    let regional = document.match(/## US Regional Endpoint Pricing([\s\S]*?)(?=\n## |$)/);
    if (regional)
      for (let rate of regional[1]!.matchAll(
        /For `([^\s`]+)` this is (\$[\d,.]+) \/ (\$[\d,.]+) \/ (\$[\d,.]+) per 1M tokens \(input \/ cached input \/ output\) below ([\d,.]+[kKmM]?) prompt tokens, and (\$[\d,.]+) \/ (\$[\d,.]+) \/ (\$[\d,.]+) above\./g
      )) {
        // Rates are scoped to the `https://us.api.x.ai/v1` endpoint, and the
        // listed long-context rates apply once a prompt exceeds the threshold.
        add(
          rate[1]!,
          priceCell(rate[2]),
          priceCell(rate[4]),
          priceCell(rate[3]),
          {
            endpoint: 'us',
            contextTiers: [
              {
                minInputTokens: tokenCount(rate[5]!) + 1,
                input: priceCell(rate[6]),
                output: priceCell(rate[8]),
                cacheRead: priceCell(rate[7])
              }
            ]
          }
        );
      }

    return { ...requirePrices(data, 'xai'), issues };
  });
