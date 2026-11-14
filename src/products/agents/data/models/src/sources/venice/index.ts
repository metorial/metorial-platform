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

export let parseVenice = (raw: unknown) =>
  extractPrices('venice', () => {
    let items = jsonArray(jsonObject(raw, 'venice').data, 'venice');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let skip = (id: string, reason: string) => {
      issues.push(`venice ${id}: ${reason}`);
    };
    for (let rawItem of items) {
      let item = jsonObject(rawItem, `venice model`);
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

      {
        if (!['text', 'embedding', 'decision', 'asr', 'tts'].includes(item.type)) {
          skip(model, `${item.type} pricing requires quality/resolution selection`);
          continue;
        }
        let p = jsonObject(
          jsonObject(item.model_spec, `${model} spec`).pricing,
          `${model} pricing`
        );
        let usd = (key: string) => amount(jsonObject(p[key], `${model} ${key}`).usd);
        if (item.type === 'text' || item.type === 'embedding' || item.type === 'decision')
          add(
            usd('input'),
            p.output == null ? null : usd('output'),
            p.cache_input == null ? null : usd('cache_input')
          );
        else if (item.type === 'asr' && p.per_audio_second)
          add(null, null, null, {
            modality: 'audio',
            units: [
              {
                modality: 'audio',
                direction: 'input',
                unit: 'second',
                price: usd('per_audio_second')
              }
            ]
          });
        else if (item.type === 'tts' && p.input)
          add(null, null, null, {
            modality: 'audio',
            units: [
              {
                modality: 'text',
                direction: 'input',
                unit: 'character',
                price: usd('input') / 1e6
              }
            ]
          });
        else skip(model, `${item.type} pricing requires quality/resolution selection`);
      }
    }
    let result = requirePrices(data, 'venice');
    return { ...result, issues: [...result.issues, ...issues] };
  });
