import type { ContextTier, TokenRates, UnitPrice } from '../../types';
import {
  amount,
  extractPrices,
  pricingDocument,
  publishedRates,
  requirePrices,
  type PublishedPrice
} from '../pricing';

let months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

let dateValue = (month: string, day: string, year: string) => {
  let index = months.indexOf(month);
  if (index < 0) throw new Error(`unknown month ${month}`);
  return `${year}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export let parseGoogle = (raw: unknown, now = new Date().toISOString()) =>
  extractPrices('google-ai-studio', () => {
    let document = pricingDocument(raw, 'google-ai-studio');
    let data: PublishedPrice[] = [];
    let issues: string[] = [];
    let today = now.slice(0, 10);

    for (let section of document.split(/^## /m).slice(1)) {
      let intro = section.split('{% hr /%}')[0]!;
      let models = [...intro.matchAll(/\[`([^`]+)`\]/g)].map(match => match[1]!);
      if (!models.length) continue;

      let standard = section.match(/{% tab title="Standard" %}([\s\S]*?){% \/tab %}/)?.[1];
      if (!standard && section.includes('{% tab title=')) {
        issues.push(`google ${models[0]}: no Standard tier table`);
        continue;
      }
      let tables = [...(standard ?? section).matchAll(/{% table %}([\s\S]*?){% \/table %}/g)];
      if (!tables.length) throw new Error(`${models[0]}: missing pricing table`);

      let rates = new Map<PublishedPrice['modality'], TokenRates>();
      let tiers = new Map<PublishedPrice['modality'], Map<number, ContextTier>>();
      let units: UnitPrice[] = [];
      let validUntil: string | undefined;
      let recognized = 0;
      let rateFor = (modality: PublishedPrice['modality']) => {
        let rate = rates.get(modality);
        if (!rate) {
          rate = publishedRates({ input: null, output: null, cacheRead: null });
          rates.set(modality, rate);
        }
        return rate;
      };

      for (let table of tables) {
        let rows = table[1]!
          .split(/^\s*---\s*$/m)
          .map(row =>
            [...row.matchAll(/^\s*\* ([\s\S]*?)(?=^\s*\* |$(?![\s\S]))/gm)].map(match =>
              match[1]!.trim()
            )
          );
        let header = rows.shift();
        if (!header || !header[2]?.includes('Paid Tier, per 1M tokens in USD')) {
          issues.push(`google ${models[0]}: non-token table`);
          continue;
        }

        for (let cells of rows) {
          if (cells.length !== 3)
            throw new Error(`${models[0]}: pricing table cell count changed`);
          let feature = cells[0]!;
          let field: 'input' | 'output' | 'cacheRead' | null = /input price/i.test(feature)
            ? 'input'
            : /output price/i.test(feature)
              ? 'output'
              : /Context caching price/i.test(feature)
                ? 'cacheRead'
                : null;
          if (!field) continue;
          recognized++;

          let value = cells[2]!.replace(/{%[\s\S]*?%}/g, '').replace(/\\/g, '');
          if (/^(Not available|Not applicable|Free of charge)/.test(value)) {
            if (value.startsWith('Not applicable') && value.includes('0 output tokens'))
              rateFor('text').output = 0;
            continue;
          }

          let applied = 0;
          for (let line of value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)) {
            if (!line.startsWith('$')) {
              if (/^(Implicit caching|Equivalent|equivalent|and |Explicit caching)/.test(line))
                continue;
              throw new Error(`${models[0]}: unrecognized pricing annotation ${line}`);
            }

            let date = line.match(/(through|starting) ([A-Za-z]+) (\d{1,2}), (\d{4})/);
            if (/\b(through|starting)\b/.test(line) && !date)
              throw new Error(`${models[0]}: unrecognized effective date`);
            if (date) {
              let boundary = dateValue(date[2]!, date[3]!, date[4]!);
              if (date[1] === 'through') {
                if (today > boundary) continue;
                if (!validUntil || boundary < validUntil) validUntil = boundary;
              } else if (today < boundary) continue;
            }

            let price = line.match(/^\$([\d.]+)/);
            if (!price) throw new Error(`${models[0]}: invalid price ${line}`);
            let number = amount(price[1]);
            if (/tokens per hour \(storage price\)/.test(line)) {
              units.push({
                modality: 'text',
                direction: 'input',
                unit: 'token-hour',
                price: number / 1e6
              });
              continue;
            }
            if (/^\$[\d.]+ per (?:[\dKk./]+ (?:resolution )?)?image/.test(line)) {
              units.push({
                modality: 'image',
                direction: field === 'input' ? 'input' : 'output',
                unit: line.match(/^\$[\d.]+ per (.*?image)/)![1]!.replace(/\s+/g, '-'),
                price: number
              });
              applied++;
              continue;
            }
            if (/^\$[\d.]+\s*(?:per\s|\/)/.test(line))
              throw new Error(`${models[0]}: unrecognized billing unit ${line}`);

            let annotations =
              `${feature.match(/^([A-Za-z]+) (?:input|output) price/)?.[1] ?? ''} ${line.match(/\(([^)]*)\)/)?.[1] ?? ''}`.toLowerCase();
            let modalities = (['text', 'image', 'audio', 'video'] as const).filter(modality =>
              annotations.includes(modality)
            );
            if (!modalities.length)
              modalities = field === 'cacheRead' && rates.size ? [...rates.keys()] : ['text'];

            let context = line.match(/prompts\s*(>=|>|<=|≤|≥)\s*([\d.,]+)([kKmM]?)/);
            for (let modality of modalities) {
              if (
                context &&
                (context[1] === '>' || context[1] === '>=' || context[1] === '≥')
              ) {
                let min =
                  amount(
                    context[2]!.replace(/,/g, ''),
                    { k: 1000, m: 1e6 }[context[3]!.toLowerCase()] ?? 1
                  ) + (context[1] === '>' ? 1 : 0);
                let byMin = tiers.get(modality) ?? new Map<number, ContextTier>();
                let tier = byMin.get(min) ?? {
                  minInputTokens: min,
                  input: null,
                  output: null,
                  cacheRead: null
                };
                tier[field] = number;
                byMin.set(min, tier);
                tiers.set(modality, byMin);
              } else {
                let rate = rateFor(modality);
                if (rate[field] !== null && rate[field] !== number)
                  throw new Error(`${models[0]}: ambiguous ${modality} ${field} price`);
                rate[field] = number;
              }
            }
            applied++;
          }

          if (!applied && !units.length)
            throw new Error(`${models[0]}: no currently applicable ${field} price`);
        }
      }

      if (!recognized) {
        issues.push(`google ${models[0]}: non-token model pricing`);
        continue;
      }
      if (!rates.size && !units.length) {
        issues.push(`google ${models[0]}: paid tier unavailable`);
        continue;
      }
      if (!rates.size) rateFor('text');

      for (let model of models)
        for (let [modality, rate] of rates)
          data.push({
            model,
            modality,
            rates: rate,
            contextTiers: tiers.has(modality)
              ? [...tiers.get(modality)!.values()].sort(
                  (a, b) => a.minInputTokens - b.minInputTokens
                )
              : null,
            ...(units.length && modality === rates.keys().next().value ? { units } : {}),
            ...(validUntil ? { validUntil } : {})
          });
    }

    return { ...requirePrices(data, 'google-ai-studio'), issues };
  });
