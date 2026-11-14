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

export let parseNovita = (raw: unknown) =>
  extractPrices('novita', () => {
    let items = jsonArray(jsonObject(raw, 'novita').data, 'novita');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let skip = (id: string, reason: string) => {
      issues.push(`novita ${id}: ${reason}`);
    };
    for (let rawItem of items) {
      let item = jsonObject(rawItem, `novita model`);
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

      if (item.pricing?.multimodal_input || item.pricing?.multimodal_output) {
        skip(model, 'multimodal billing requires separate modality configuration');
        continue;
      }
      let rates = (raw: unknown) => {
        let p = jsonObject(raw, `${model} pricing`);
        let value = (key: string) =>
          amount(jsonObject(p[key], `${model} ${key}`).price_per_m_decimal);
        return publishedRates({
          input: value('prompt'),
          output: value('completion'),
          cacheRead: p.input_cache_read == null ? null : value('input_cache_read')
        });
      };
      if (item.pricing == null) {
        if (item.input_token_price_per_m === 0 && item.output_token_price_per_m === 0)
          add(0, 0, null);
        else skip(model, 'router or unpriced entry');
        continue;
      }
      let price = {
        model,
        modality: 'text' as const,
        rates: rates(item.pricing),
        contextTiers: null
      } as PublishedPrice;
      if (item.is_tiered_billing) {
        let tiers = jsonArray(item.tiered_billing_configs, `${model} tiers`).map(t =>
          jsonObject(t, 'tier')
        );
        if (tiers.length < 2) throw new Error(`${model}: missing billing tiers`);
        price.contextTiers = tiers.slice(1).map(tier => {
          let r = rates(tier.pricing);
          return {
            minInputTokens: amount(tier.min_tokens),
            input: r.input,
            output: r.output,
            cacheRead: r.cacheRead
          };
        });
      }
      data.push(price);
    }
    let result = requirePrices(data, 'novita');
    return { ...result, issues: [...result.issues, ...issues] };
  });
