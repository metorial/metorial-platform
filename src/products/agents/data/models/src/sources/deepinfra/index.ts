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

export let parseDeepInfra = (raw: unknown) =>
  extractPrices('deepinfra', () => {
    let items = jsonArray(raw, 'deepinfra');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let skip = (id: string, reason: string) => {
      issues.push(`deepinfra ${id}: ${reason}`);
    };
    for (let rawItem of items) {
      let item = jsonObject(rawItem, `deepinfra model`);
      let model = modelId(item.model_name);
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

      let p = jsonObject(item.pricing, `${model} pricing`);
      if (item.deprecated) {
        skip(model, 'deprecated');
        continue;
      }
      if (p.type === 'tokens' || p.type === 'input_tokens') {
        if (p.table != null)
          throw new Error(`${model}: unexpected conditional token pricing table`);
        let input = amount(p.cents_per_input_token, 1e4);
        let cacheRead =
          p.rate_per_input_token_cached == null
            ? null
            : amount(p.rate_per_input_token_cached) * input;
        let writes =
          p.rate_per_input_token_cache_write == null
            ? []
            : [{ ttl: null, price: amount(p.rate_per_input_token_cache_write) * input }];
        add(
          input,
          p.type === 'input_tokens' ? null : amount(p.cents_per_output_token, 1e4),
          cacheRead
        );
        data.at(-1)!.rates.cacheWrite = writes;
      } else if (
        p.type === 'input_character_length' ||
        p.type === 'input_length' ||
        p.type === 'time'
      ) {
        let characters = p.type === 'input_character_length';
        let value = characters
          ? p.cents_per_input_chars
          : p.type === 'time'
            ? p.cents_per_sec
            : p.cents_per_input_sec;
        add(null, null, null, {
          modality: 'audio',
          units: [
            {
              modality: characters ? 'text' : 'audio',
              direction: 'input',
              unit: characters ? 'character' : p.type === 'time' ? 'compute-second' : 'second',
              price: amount(value, 0.01)
            }
          ]
        });
      } else if (['frame_units', 'image_units', 'output_length'].includes(p.type)) {
        skip(model, `resolution/step dependent ${p.type} pricing`);
      } else throw new Error(`${model}: unknown pricing type ${p.type}`);
    }
    let result = requirePrices(data, 'deepinfra');
    return { ...result, issues: [...result.issues, ...issues] };
  });
