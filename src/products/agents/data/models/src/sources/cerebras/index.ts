import {
  amount,
  extractPrices,
  jsonArray,
  jsonObject,
  modelId,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

export let parseCerebras = (raw: unknown) =>
  extractPrices('cerebras', () => {
    let items = jsonArray(jsonObject(raw, 'cerebras').data, 'cerebras models');
    let data: PublishedPrice[] = [];

    for (let rawItem of items) {
      let item = jsonObject(rawItem, 'cerebras model');
      let model = modelId(item.id);
      let p = jsonObject(item.pricing, `${model} pricing`);

      data.push({
        model,
        modality: 'text',
        rates: publishedRates({
          input: amount(p.prompt, 1e6),
          output: amount(p.completion, 1e6),
          cacheRead: p.input_cache_read == null ? null : amount(p.input_cache_read, 1e6)
        }),
        contextTiers: null
      });
    }

    return requirePrices(data, 'cerebras');
  });
