import { describe, expect, it } from 'vitest';
import { planPriceCorrection, type CorrectablePeriod } from '../corrections';

let at = (date: string) => new Date(`${date}T00:00:00.000Z`);

let period = (oid: number, from: string, to: string | null = null): CorrectablePeriod => ({
  oid: BigInt(oid),
  validFrom: at(from),
  validTo: to ? at(to) : null
});

describe('price correction planning', () => {
  it('splits the open period around a range inside it', () => {
    expect(
      planPriceCorrection({
        periods: [period(1, '2026-01-01')],
        from: at('2026-02-01'),
        to: at('2026-03-01')
      })
    ).toEqual({
      close: [{ oid: 1n, validTo: at('2026-02-01') }],
      remainders: [{ sourceOid: 1n, validFrom: at('2026-03-01'), validTo: null }]
    });
  });

  it('empties periods inside the range and trims the ones at its edges', () => {
    expect(
      planPriceCorrection({
        periods: [
          period(1, '2026-01-01', '2026-02-01'),
          period(2, '2026-02-01', '2026-03-01'),
          period(3, '2026-03-01', '2026-04-01'),
          period(4, '2026-04-01')
        ],
        from: at('2026-01-15'),
        to: at('2026-04-15')
      })
    ).toEqual({
      close: [
        { oid: 1n, validTo: at('2026-01-15') },
        { oid: 2n, validTo: at('2026-02-01') },
        { oid: 3n, validTo: at('2026-03-01') },
        { oid: 4n, validTo: at('2026-04-01') }
      ],
      remainders: [{ sourceOid: 4n, validFrom: at('2026-04-15'), validTo: null }]
    });
  });

  it('closes everything from the start of an open-ended range', () => {
    expect(
      planPriceCorrection({
        periods: [period(1, '2026-01-01', '2026-03-01'), period(2, '2026-03-01')],
        from: at('2026-02-01'),
        to: null
      })
    ).toEqual({
      close: [
        { oid: 1n, validTo: at('2026-02-01') },
        { oid: 2n, validTo: at('2026-03-01') }
      ],
      remainders: []
    });
  });

  it('keeps a closed period that ends after the range as a closed remainder', () => {
    expect(
      planPriceCorrection({
        periods: [period(1, '2026-01-01', '2026-05-01'), period(2, '2026-05-01')],
        from: at('2026-02-01'),
        to: at('2026-03-01')
      })
    ).toEqual({
      close: [{ oid: 1n, validTo: at('2026-02-01') }],
      remainders: [{ sourceOid: 1n, validFrom: at('2026-03-01'), validTo: at('2026-05-01') }]
    });
  });

  it('ignores empty periods and periods outside the range', () => {
    expect(
      planPriceCorrection({
        periods: [
          period(1, '2026-01-01', '2026-02-01'),
          period(2, '2026-02-10', '2026-02-10'),
          period(3, '2026-03-01')
        ],
        from: at('2026-02-01'),
        to: at('2026-03-01')
      })
    ).toEqual({ close: [], remainders: [] });
  });
});
