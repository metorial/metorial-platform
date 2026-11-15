import { parse } from 'node-html-parser';
import {
  extractPrices,
  priceCell,
  pricingDocument,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

export let parseDeepSeek = (raw: unknown) =>
  extractPrices('deepseek', () => {
    let document = parse(pricingDocument(raw, 'deepseek'));
    let table = document.querySelector('table');
    if (!table) throw new Error('missing model pricing table');

    let grid: string[][] = [];
    for (let [rowIndex, tr] of table.querySelectorAll('tr').entries()) {
      let row = (grid[rowIndex] ??= []);
      let column = 0;
      for (let cell of tr.querySelectorAll('td, th')) {
        while (row[column] !== undefined) column++;
        let width = Number(cell.getAttribute('colspan') ?? 1);
        let height = Number(cell.getAttribute('rowspan') ?? 1);
        if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 30))
          throw new Error('invalid table span');

        let text = cell.innerHTML
          .replace(/<br\s*\/?\s*>/gi, ' ')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) (grid[rowIndex + y] ??= [])[column + x] = text;
        column += width;
      }
    }

    let models = grid.find(row => row[0] === 'MODEL');
    if (!models || models.length < 4) throw new Error('missing model identifiers');
    let policy = document.textContent.match(
      /Peak hours are [\s\S]+?All other hours are off-peak[^.]*\./
    )?.[0];
    let conditional = grid.some(row => row.includes('OFF-PEAK'));
    if (conditional && !policy) throw new Error('time-based prices have no scheduling policy');

    let data: PublishedPrice[] = [];
    for (let column = 3; column < models.length; column++) {
      let model = models[column]!.replace(/\s*\(\d+\)$/, '');
      let ratesFor = (period?: string) => {
        let rate = (pattern: RegExp) => {
          let row = grid.find(
            row => pattern.test(row.slice(0, 3).join(' ')) && (!period || row[2] === period)
          );
          if (!row) throw new Error(`${model}: missing ${pattern} ${period ?? ''} price`);
          return priceCell(row[column]);
        };
        return publishedRates({
          input: rate(/INPUT TOKENS.*CACHE MISS/),
          output: rate(/OUTPUT TOKENS/),
          cacheRead: rate(/INPUT TOKENS.*CACHE HIT/)
        });
      };

      data.push({
        model,
        modality: 'text',
        rates: conditional
          ? publishedRates({ input: null, output: null, cacheRead: null })
          : ratesFor(),
        contextTiers: null,
        ...(conditional
          ? {
              conditions: ['PEAK', 'OFF-PEAK'].map(label => ({
                label,
                description: policy!,
                rates: ratesFor(label)
              }))
            }
          : {})
      });
    }

    return requirePrices(data, 'deepseek');
  });
