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

export let parseHuggingFace = (raw: unknown) =>
  extractPrices('huggingface', () => {
    let items = jsonArray(jsonObject(raw, 'huggingface').data, 'huggingface');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let skip = (id: string, reason: string) => {
      issues.push(`huggingface ${id}: ${reason}`);
    };
    for (let rawItem of items) {
      let item = jsonObject(rawItem, `huggingface model`);
      let model = modelId(item.id);
      let add = (
        input: number | null,
        output: number | null,
        cacheRead: number | null,
        extra: Partial<PublishedPrice> = {}
      ) => {
        data.push({
          model,
          modality: 'text',
          rates: publishedRates({ input, output, cacheRead }),
          contextTiers: null,
          ...extra
        });
      };

      let conditions: NonNullable<PublishedPrice['conditions']> = [];
      for (let rawProvider of jsonArray(item.providers, `${model} providers`)) {
        let provider = jsonObject(rawProvider, 'provider');
        if (provider.pricing == null) {
          skip(`${model}:${provider.provider}`, 'no provider price published');
          continue;
        }
        let p = jsonObject(provider.pricing, 'provider pricing');
        let rates = publishedRates({
          input: amount(p.input),
          output: amount(p.output),
          cacheRead: null
        });
        let route = modelId(provider.provider);
        conditions.push({
          label: route,
          description: `Hugging Face route ${model}:${route}`,
          rates
        });
        data.push({
          model: `${model}:${route}`,
          modality: 'text',
          rates,
          contextTiers: null
        });
      }
      if (conditions.length) add(null, null, null, { conditions });
    }
    let result = requirePrices(data, 'huggingface');
    return { ...result, issues: [...result.issues, ...issues] };
  });
