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

export let parseLlmGateway = (raw: unknown) =>
  extractPrices('llmgateway', () => {
    let items = jsonArray(jsonObject(raw, 'llmgateway').data, 'llmgateway');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let skip = (id: string, reason: string) => {
      issues.push(`llmgateway ${id}: ${reason}`);
    };
    for (let rawItem of items) {
      let item = jsonObject(rawItem, `llmgateway model`);
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
      if (
        model === 'custom' ||
        /^llmgateway\/(custom|smart|auto)$/.test(model) ||
        item.free === true
      ) {
        skip(model, 'custom or free routing entry');
        continue;
      }
      let mapping = jsonArray(item.providers, `${model} mappings`);
      if (mapping && mapping.length !== 1)
        throw new Error(`${model}: expected one provider-pinned mapping`);
      let p = jsonObject(mapping?.[0]?.pricing ?? item.pricing, `${model} pricing`);
      let scale = 1e6;
      let units: NonNullable<PublishedPrice['units']> = [];
      let unitFields = [
        ['input_character', 'text', 'input', 'character'],
        ['input_audio_hour', 'audio', 'input', 'hour'],
        ['input_text_item', 'text', 'input', 'text-item'],
        ['ocr_page', 'text', 'input', 'page'],
        ['request', 'text', 'input', 'request'],
        ['image', 'image', 'output', 'image'],
        ['image_output', 'image', 'output', 'image']
      ] as const;
      for (let [key, modality, direction, unit] of unitFields) {
        if (p[key] != null && amount(p[key]) > 0)
          units.push({ modality, direction, unit, price: amount(p[key]) });
      }
      if (amount(p.prompt) === 0 && amount(p.completion) === 0 && !units.length) {
        skip(model, 'no unconditional token price; requires additional billing configuration');
        continue;
      }
      let cacheWrite = ['input_cache_write', 'input_cache_write_1h'].flatMap((key, index) =>
        p[key] == null ? [] : [{ ttl: index ? '1h' : null, price: amount(p[key], scale) }]
      );
      add(
        amount(p.prompt, scale),
        amount(p.completion, scale),
        p.input_cache_read == null ? null : amount(p.input_cache_read, scale)
      );
      data.at(-1)!.rates.cacheWrite = cacheWrite;
      if (units.length) {
        data.at(-1)!.units = units;
        if (amount(p.prompt) === 0 && amount(p.completion) === 0)
          data.at(-1)!.rates = publishedRates({
            input: null,
            output: null,
            cacheRead: null
          });
      }
      if (p.tiers) {
        let tiers = jsonArray(p.tiers, `${model} context tiers`).map(t =>
          jsonObject(t, 'context tier')
        );
        if (!tiers.length) throw new Error(`${model}: empty context tiers`);
        data.at(-1)!.contextTiers = tiers.slice(1).map((tier, index) => ({
          minInputTokens: amount(tiers[index]!.up_to_tokens) + 1,
          input: amount(tier.prompt, scale),
          output: amount(tier.completion, scale),
          cacheRead:
            tier.input_cache_read == null ? null : amount(tier.input_cache_read, scale)
        }));
      }
      if (p.peak) {
        let peak = jsonObject(p.peak, `${model} peak pricing`);
        let price = data.at(-1)!;
        price.conditions = ['peak', 'off_peak'].map(label => {
          let r = jsonObject(peak[label], `${model} ${label} pricing`);
          return {
            label,
            description: `Provider-published UTC hours ${JSON.stringify(peak.hours_utc ?? [])}; off-peak weekdays ${JSON.stringify(peak.off_peak_days_utc ?? [])}`,
            rates: publishedRates({
              input: amount(r.prompt, scale),
              output: amount(r.completion, scale),
              cacheRead: r.input_cache_read == null ? null : amount(r.input_cache_read, scale)
            })
          };
        });
        price.rates = publishedRates({ input: null, output: null, cacheRead: null });
      }
    }
    let result = requirePrices(data, 'llmgateway');
    return { ...result, issues: [...result.issues, ...issues] };
  });
