import { describe, expect, it } from 'vitest';
import { buildRetryParams, InputRequestRound, isInputRequiredResult } from './mrtr';

let inputRequired = {
  resultType: 'input_required' as const,
  inputRequests: {
    login: { method: 'elicitation/create', params: { message: 'Who are you?' } },
    capital: { method: 'sampling/createMessage', params: { maxTokens: 10 } }
  },
  requestState: 'opaque'
};

describe('isInputRequiredResult', () => {
  it('detects input_required results only', () => {
    expect(isInputRequiredResult(inputRequired)).toBe(true);
    expect(isInputRequiredResult({ resultType: 'complete' })).toBe(false);
    expect(isInputRequiredResult({ content: [] })).toBe(false);
    expect(isInputRequiredResult(null)).toBe(false);
  });
});

describe('InputRequestRound', () => {
  it('emits legacy requests only for declared client capabilities', () => {
    let round = InputRequestRound.create(inputRequired, { elicitation: {} });

    expect(round.legacyRequests).toHaveLength(1);
    expect(round.legacyRequests[0]).toMatchObject({
      jsonrpc: '2.0',
      method: 'elicitation/create',
      params: { message: 'Who are you?' }
    });
    expect(round.unsupportedKeys).toEqual(['capital']);
  });

  it('collects responses keyed by the original input request keys', async () => {
    let round = InputRequestRound.create(inputRequired, { elicitation: {}, sampling: {} });
    let [first, second] = round.legacyRequests;

    expect(round.consume({ jsonrpc: '2.0', id: 'unrelated', result: {} })).toBe(false);
    expect(
      round.consume({ jsonrpc: '2.0', id: first!.id, result: { action: 'accept' } })
    ).toBe(true);
    expect(round.isSettled).toBe(false);

    round.consume({ jsonrpc: '2.0', id: second!.id, result: { role: 'assistant' } });

    await expect(round.wait()).resolves.toEqual({
      login: { action: 'accept' },
      capital: { role: 'assistant' }
    });
  });

  it('settles immediately when there is nothing to ask', async () => {
    let round = InputRequestRound.create(
      { resultType: 'input_required', requestState: 's' },
      {}
    );

    expect(round.isSettled).toBe(true);
    await expect(round.wait()).resolves.toEqual({});
  });

  it('rejects waiters when cancelled', async () => {
    let round = InputRequestRound.create(inputRequired, { elicitation: {} });
    round.cancel(new Error('gone'));

    await expect(round.wait()).rejects.toThrow('gone');
  });
});

describe('buildRetryParams', () => {
  it('adds input responses and echoes request state', () => {
    expect(
      buildRetryParams({ name: 'tool', arguments: { a: 1 } }, inputRequired, {
        login: { action: 'accept' }
      })
    ).toEqual({
      name: 'tool',
      arguments: { a: 1 },
      inputResponses: { login: { action: 'accept' } },
      requestState: 'opaque'
    });
  });

  it('drops stale state from a previous round', () => {
    expect(
      buildRetryParams(
        { name: 'tool', inputResponses: { old: {} }, requestState: 'old' },
        { resultType: 'input_required', inputRequests: {} },
        {}
      )
    ).toEqual({ name: 'tool' });
  });
});
