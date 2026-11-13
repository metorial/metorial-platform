import type { Offering } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import { computeRequestCost } from '../cost';
import { fixtureCatalog } from './fixture';

let offeringById = (id: string) =>
  fixtureCatalog.offerings.find(offering => offering.id == id)!;

let sonnet = offeringById('anthropic:claude-sonnet-4-5');
let gpt = offeringById('openai:gpt-5');

let tokens = (values: Partial<Parameters<typeof computeRequestCost>[0]['tokens']>) => ({
  inputUncached: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
  ...values
});

describe('computeRequestCost', () => {
  it('prices each token component per million', () => {
    let cost = computeRequestCost({
      offering: sonnet,
      tokens: tokens({ inputUncached: 1_000_000, output: 100_000, cacheRead: 1_000_000 }),
      contextTokens: 10_000
    });

    expect(cost).toBeCloseTo(3 + 1.5 + 0.3, 10);
  });

  it('applies the context tier the request reaches', () => {
    let cost = computeRequestCost({
      offering: sonnet,
      tokens: tokens({ inputUncached: 1_000_000, output: 1_000_000, cacheRead: 1_000_000 }),
      contextTokens: 250_000
    });

    expect(cost).toBeCloseTo(6 + 22.5 + 0.6, 10);
  });

  it('prices cache writes by their TTL', () => {
    let cost = computeRequestCost({
      offering: sonnet,
      tokens: tokens({
        cacheWrite: 3_000_000,
        cacheWrite5m: 1_000_000,
        cacheWrite1h: 1_000_000
      }),
      contextTokens: 0
    });

    expect(cost).toBeCloseTo(3.75 + 6 + 3.75, 10);
  });

  it('falls back to the input rate for cache writes and the output rate for reasoning', () => {
    let cost = computeRequestCost({
      offering: gpt,
      tokens: tokens({ cacheWrite: 1_000_000, reasoning: 1_000_000 }),
      contextTokens: 0
    });

    expect(cost).toBeCloseTo(1.25 + 10, 10);
  });

  it('leaves a request unpriced when a used component has no rate', () => {
    let unpriced = {
      ...gpt,
      pricing: { ...gpt.pricing!, text: { ...gpt.pricing!.text!, output: null } }
    } as Offering;

    expect(
      computeRequestCost({
        offering: unpriced,
        tokens: tokens({ output: 10 }),
        contextTokens: 0
      })
    ).toBeUndefined();
    expect(
      computeRequestCost({
        offering: unpriced,
        tokens: tokens({ inputUncached: 1_000_000 }),
        contextTokens: 0
      })
    ).toBeCloseTo(1.25, 10);
  });
});
