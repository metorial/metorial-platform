import Anthropic from '@anthropic-ai/sdk';
import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import { toNanoUsd } from '@mtsrc/ai-gateway-module-billing';
import type { GatewayPrincipal, ProjectRestriction } from '@mtsrc/ai-gateway-spec';
import type { Script } from '@mtsrc/ai-gateway-testing';
import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { ask, chatRequest, messagesRequest } from './clients';
import { createGateway, principal, providerCases } from './harness';

let hello: Script = {
  steps: [{ type: 'text', text: 'Hello.' }],
  usage: { input: 1200, output: 300 }
};

let dialects: Dialect[] = ['openai_chat', 'open_responses', 'anthropic_messages'];

let restricted = (d: {
  disabled?: ProjectRestriction;
  billingRestriction?: ProjectRestriction;
}): GatewayPrincipal => ({
  ...principal,
  project: { ...principal.project, ...d }
});

let caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the request to fail.');
};

let billedUsdOf = (gateway: ReturnType<typeof createGateway>) =>
  gateway.logs.reduce((total, record) => total + (record.log.billedCost?.totalUsd ?? 0), 0);

describe('requests over Metorial keys are billed at their cost', () => {
  for (let dialect of dialects) {
    for (let stream of [false, true]) {
      it(`${dialect}${stream ? ' (streaming)' : ''}`, async () => {
        let gateway = createGateway({
          providers: ['anthropic'],
          upstream: hello,
          owner: 'platform'
        });

        await ask(gateway, dialect, { prompt: 'hi' }, { stream });

        let billedUsd = billedUsdOf(gateway);
        expect(billedUsd).toBeGreaterThan(0);
        expect(await gateway.billed()).toEqual([
          { projectId: 'gwpr_e2e', costNanoUsd: toNanoUsd(billedUsd), requestCount: 1 }
        ]);
      });
    }
  }

  it.each(providerCases.map(provider => provider.slug))(
    'over every platform provider (%s)',
    async slug => {
      let gateway = createGateway({ providers: [slug], upstream: hello, owner: 'platform' });

      await ask(gateway, 'openai_chat', { prompt: 'hi' }, { stream: true });

      let [charge] = await gateway.billed();
      expect(charge).toMatchObject({ projectId: 'gwpr_e2e', requestCount: 1 });
      expect(charge!.costNanoUsd).toBeGreaterThan(0n);
    }
  );

  it('sums a project’s requests into one write', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      owner: 'platform'
    });

    for (let dialect of dialects)
      await ask(gateway, dialect, { prompt: 'hi' }, { stream: false });

    expect(await gateway.billed()).toEqual([
      {
        projectId: 'gwpr_e2e',
        costNanoUsd: toNanoUsd(billedUsdOf(gateway)),
        requestCount: 3
      }
    ]);
  });
});

describe('requests over the customer’s own connections are free', () => {
  it.each(dialects)('%s', async dialect => {
    let gateway = createGateway({ providers: ['anthropic'], upstream: hello });

    await ask(gateway, dialect, { prompt: 'hi' }, { stream: true });

    expect(gateway.logs[0]!.log.status).toBe('succeeded');
    expect(await gateway.billed()).toEqual([]);
  });

  it('bills nothing when a platform candidate failed over to a customer connection', async () => {
    let attempts = 0;
    let gateway = createGateway({
      providers: ['anthropic', 'openai'],
      owner: ['platform', 'customer'],
      upstream: () =>
        ++attempts == 1
          ? {
              steps: [],
              httpError: { status: 503, body: { error: { message: 'overloaded' } } }
            }
          : hello
    });

    await ask(gateway, 'openai_chat', { prompt: 'hi' }, { stream: false });

    expect(gateway.logs[0]!.log.route).toMatchObject({ connectionOwner: 'customer' });
    expect(await gateway.billed()).toEqual([]);
  });
});

describe('a billing-restricted project', () => {
  let outOfCredits = restricted({ billingRestriction: { reason: 'Your credits ran out.' } });

  it('gives OpenAI clients a 402 with the restriction code', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      owner: 'platform',
      principal: outOfCredits
    });

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(OpenAI.APIError);
    let apiError = error as InstanceType<typeof OpenAI.APIError>;
    expect(apiError.status).toBe(402);
    expect(apiError.code).toBe('billing_restricted');
    expect(apiError.message).toContain('Your credits ran out.');
    expect(gateway.upstream.requests).toHaveLength(0);
    expect(await gateway.billed()).toEqual([]);
  });

  it('gives Anthropic clients a billing_error', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      owner: 'platform',
      principal: outOfCredits
    });

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.APIError);
    let apiError = error as InstanceType<typeof Anthropic.APIError>;
    expect(apiError.status).toBe(402);
    expect(apiError.error).toMatchObject({
      type: 'error',
      error: { type: 'billing_error' }
    });
  });

  it('keeps serving over its own connections', async () => {
    let gateway = createGateway({
      providers: ['anthropic', 'openai'],
      owner: ['platform', 'customer'],
      upstream: hello,
      principal: outOfCredits
    });

    let turn = await ask(gateway, 'anthropic_messages', { prompt: 'hi' }, { stream: true });

    expect(turn.text).toBe('Hello.');
    expect(gateway.upstream.requests).toHaveLength(1);
    expect(gateway.logs[0]!.log.route).toMatchObject({ connectionOwner: 'customer' });
    expect(await gateway.billed()).toEqual([]);
  });
});

describe('a project without AI gateway access', () => {
  let disabled = restricted({
    disabled: { reason: 'Upgrade your plan to use the AI gateway.' }
  });

  it('gives OpenAI clients a PermissionDeniedError, even over their own connections', async () => {
    let gateway = createGateway({
      providers: ['openai'],
      upstream: hello,
      principal: disabled
    });

    let error = await caught(
      gateway.openai.chat.completions.create(chatRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(OpenAI.PermissionDeniedError);
    let denied = error as InstanceType<typeof OpenAI.PermissionDeniedError>;
    expect(denied.code).toBe('gateway_disabled');
    expect(denied.message).toContain('Upgrade your plan to use the AI gateway.');
    expect(gateway.upstream.requests).toHaveLength(0);
  });

  it('gives Anthropic clients a PermissionDeniedError', async () => {
    let gateway = createGateway({
      providers: ['anthropic'],
      upstream: hello,
      principal: disabled
    });

    let error = await caught(
      gateway.anthropic.messages.create(messagesRequest({ prompt: 'hi' }))
    );

    expect(error).toBeInstanceOf(Anthropic.PermissionDeniedError);
    expect(gateway.logs[0]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'limits', code: 'gateway_disabled', httpStatus: 403 }
    });
  });
});
