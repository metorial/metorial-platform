import { describe, expect, it } from 'vitest';
import {
  claudeCodeBilling,
  claudeCodeProvider,
  codexBilling,
  genAiBilling
} from '../src/billing';

describe('claudeCodeProvider', () => {
  it.each([
    ['firstParty', 'anthropic'],
    ['bedrock', 'bedrock'],
    ['vertex', 'vertex'],
    ['foundry', 'azure'],
    ['gateway', 'gateway'],
    ['anthropicAws', 'other:anthropicaws'],
    ['mantle', 'other:mantle'],
    [' FirstParty ', 'anthropic']
  ])('maps %j to %s', (raw, expected) => {
    expect(claudeCodeProvider(raw)).toBe(expected);
  });

  it.each([undefined, '', '   '])('has no provider for %j', raw => {
    expect(claudeCodeProvider(raw)).toBeUndefined();
  });

  it.each(['constructor', '__proto__', 'toString'])(
    'does not resolve the prototype key %s',
    raw => {
      expect(claudeCodeProvider(raw)).toMatch(/^other:/);
    }
  );
});

describe('claudeCodeBilling', () => {
  it('treats a plan with a regular seat as included', () => {
    expect(
      claudeCodeBilling({ provider: 'firstParty', plan: 'max', seat: 'premium' })
    ).toEqual({ mode: 'included', plan: 'max', seat: 'premium' });
    expect(claudeCodeBilling({ plan: 'team', seat: 'standard' })).toEqual({
      mode: 'included',
      plan: 'team',
      seat: 'standard'
    });
  });

  it('treats a plan without a seat as included', () => {
    expect(claudeCodeBilling({ provider: 'firstParty', plan: 'pro' })).toEqual({
      mode: 'included',
      plan: 'pro'
    });
  });

  it('treats a usage-based seat as api billing and keeps the plan', () => {
    expect(
      claudeCodeBilling({ provider: 'firstParty', plan: 'enterprise', seat: 'usage_based' })
    ).toEqual({ mode: 'api', plan: 'enterprise', seat: 'usage_based' });
    expect(claudeCodeBilling({ plan: 'enterprise', seat: 'usageBased' })).toMatchObject({
      mode: 'api'
    });
  });

  it('normalizes plan and seat labels', () => {
    expect(claudeCodeBilling({ plan: ' Max ', seat: 'PREMIUM' })).toEqual({
      mode: 'included',
      plan: 'max',
      seat: 'premium'
    });
    expect(claudeCodeBilling({ plan: 'x'.repeat(100) })?.plan).toHaveLength(64);
  });

  it.each(['firstParty', 'bedrock', 'vertex', 'foundry', 'anthropicAws', 'mantle'])(
    'treats provider %s without a plan as api billing',
    provider => {
      expect(claudeCodeBilling({ provider })).toEqual({ mode: 'api' });
    }
  );

  it('ignores the seat without a plan', () => {
    expect(claudeCodeBilling({ provider: 'firstParty', seat: 'premium' })).toEqual({
      mode: 'api'
    });
  });

  it('says nothing for a gateway without a plan', () => {
    expect(claudeCodeBilling({ provider: 'gateway' })).toBeUndefined();
    expect(claudeCodeBilling({ provider: 'Gateway', seat: 'standard' })).toBeUndefined();
  });

  it('still reports a plan behind a gateway', () => {
    expect(claudeCodeBilling({ provider: 'gateway', plan: 'max' })).toEqual({
      mode: 'included',
      plan: 'max'
    });
  });

  it('says nothing without a provider or plan', () => {
    expect(claudeCodeBilling({})).toBeUndefined();
    expect(claudeCodeBilling({ provider: ' ', plan: '' })).toBeUndefined();
  });
});

describe('codexBilling', () => {
  it.each(['Chatgpt', 'ChatGPT', 'chatgpt', 'chat_gpt', 'ChatgptAuthTokens'])(
    'maps %s to included',
    authMode => {
      expect(codexBilling(authMode)).toEqual({ mode: 'included' });
    }
  );

  it.each(['ApiKey', 'apikey', 'api_key', 'API-KEY'])('maps %s to api', authMode => {
    expect(codexBilling(authMode)).toEqual({ mode: 'api' });
  });

  it.each([undefined, '', 'Unknown', 'apikeys', 'oauth'])('says nothing for %j', authMode => {
    expect(codexBilling(authMode)).toBeUndefined();
  });
});

describe('genAiBilling', () => {
  it('treats github as included', () => {
    expect(genAiBilling('github')).toEqual({ mode: 'included' });
  });

  it.each([undefined, 'openai', 'anthropic', 'azure', 'other:github_models'])(
    'says nothing for %j',
    provider => {
      expect(genAiBilling(provider)).toBeUndefined();
    }
  );
});
