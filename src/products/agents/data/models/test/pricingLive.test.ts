import { describe, expect, it } from 'vitest';
import { pricingSources } from '../src/sources/providers';
import { extractPrices } from '../src/sources/pricing';

describe('live public pricing', () => {
  it.each(pricingSources)(
    '$kind returns validated prices without credentials',
    async source => {
      let raw = await source.fetch();
      let result = extractPrices(source.kind, () =>
        source.parse(raw, new Date().toISOString())
      );
      expect(result.data.length).toBeGreaterThan(0);
      console.log(
        `${source.kind}: ${result.data.length} price records, ${result.issues.length} exclusions`
      );
    }
  );
});
