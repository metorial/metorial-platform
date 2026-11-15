import { fetchText } from '../fetch';
import {
  amount,
  extractPrices,
  jsonArray,
  jsonObject,
  modelId,
  pricingDocument,
  pricingTables,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

let indexUrl = 'https://docs.mistral.ai/models.md';
let pageConcurrency = 6;
let maxModelPages = 150;

let modelPages = (index: string) => {
  let pages: { path: string; model: string; retirement: string | null }[] = [];

  for (let table of pricingTables(index)) {
    if (!table.headers.includes('API name')) continue;
    for (let [index, row] of table.rows.entries()) {
      let model = row[table.headers.indexOf('API name')]!;
      if (!model || row[table.headers.indexOf('Status')] === 'Retired') continue;

      let path = table.rawRows[index]![0]!.match(/\]\((\/models\/[a-zA-Z0-9/-]+)\)/)?.[1];
      if (!path) throw new Error(`mistral ${model}: missing model page`);
      pages.push({
        path,
        model: modelId(model),
        retirement: table.headers.includes('Retirement')
          ? (row[table.headers.indexOf('Retirement')] ?? null)
          : null
      });
    }
  }

  if (!pages.length || pages.length > maxModelPages)
    throw new Error('mistral: unexpected model index size');
  return pages;
};

export let fetchMistral = async () => {
  let index = await fetchText(indexUrl);
  let pending = modelPages(index);
  let pages: { path: string; document: string }[] = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: pageConcurrency }, async () => {
      while (cursor < pending.length) {
        let page = pending[cursor++]!;
        let document = await fetchText(`https://docs.mistral.ai${page.path}.md`);
        pages.push({ path: page.path, document });
      }
    })
  );

  return { index, pages: pages.sort((a, b) => a.path.localeCompare(b.path)) };
};

export let parseMistral = (raw: unknown, now = new Date().toISOString()) =>
  extractPrices('mistral', () => {
    let snapshot = jsonObject(raw, 'mistral snapshot');
    let index = pricingDocument(snapshot.index, 'mistral index');
    let pages = new Map(
      jsonArray(snapshot.pages, 'mistral pages').map(rawPage => {
        let page = jsonObject(rawPage, 'mistral page');
        return [page.path, pricingDocument(page.document, 'mistral model page')];
      })
    );
    let data: PublishedPrice[] = [];
    let issues: string[] = [];

    for (let page of modelPages(index).filter(
      page => !page.retirement || page.retirement === '-' || page.retirement > now.slice(0, 10)
    )) {
      let document = pages.get(page.path);
      if (!document) throw new Error(`${page.model}: model page missing from snapshot`);

      let pricing = document.match(/^- Pricing: (.+)$/m)?.[1];
      if (!pricing) {
        issues.push(`mistral ${page.model}: no public pricing`);
        continue;
      }

      let rates = publishedRates({ input: null, output: null, cacheRead: null });
      let units: NonNullable<PublishedPrice['units']> = [];
      for (let value of pricing.split(';')) {
        if (value.trim() === 'Free' || value.trim() === '$0 /M Tokens') {
          rates.input = 0;
          rates.output = 0;
          continue;
        }
        let token = value.trim().match(/^(Input|Output|Cached input) \$([\d.]+) \/M Tokens$/i);
        if (token) {
          rates[
            token[1]!.toLowerCase() === 'input'
              ? 'input'
              : token[1]!.toLowerCase() === 'output'
                ? 'output'
                : 'cacheRead'
          ] = amount(token[2]);
          continue;
        }

        let unit = value
          .trim()
          .match(
            /^(Input|Output) \$([\d.]+) \/(Min|1000 Pages|1000 Annotated Pages|M Characters|M Chars)$/i
          );
        if (!unit) throw new Error(`${page.model}: unknown pricing format: ${value}`);
        let kind = unit[3]!.toLowerCase();
        units.push({
          modality: kind === 'min' ? 'audio' : 'text',
          direction: unit[1]!.toLowerCase() as 'input' | 'output',
          unit:
            kind === 'min'
              ? 'minute'
              : kind === 'm characters' || kind === 'm chars'
                ? 'character'
                : kind === '1000 pages'
                  ? 'page'
                  : 'annotated-page',
          price: amount(
            unit[2],
            kind === 'min' ? 1 : kind === 'm characters' || kind === 'm chars' ? 1e-6 : 0.001
          )
        });
      }

      data.push({
        model: page.model,
        modality: 'text',
        rates,
        contextTiers: null,
        ...(units.length ? { units } : {})
      });
    }

    return { ...requirePrices(data, 'mistral'), issues };
  });
