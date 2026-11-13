import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { textPricing } from '@mtsrc/agent-tracking-module-knowledge/test/fixture';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import {
  createOrganization,
  createProject,
  createToken,
  agentTracking,
  rpcErrorCode
} from './support';

let hourMs = 60 * 60 * 1000;
let sonnetModel = 'claude-sonnet-4-5-20250929';
let sonnetOfferingId = 'anthropic:claude-sonnet-4-5-20250929';

type CreateInput = Parameters<
  ReturnType<typeof agentTracking>['pricing']['overrides']['create']
>[0];

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

describe('organization price overrides', { timeout: 180_000 }, () => {
  it('reprices settled sessions as overrides change', async () => {
    await importKnowledge();

    let { organization, instance, secret } = await createToken();

    await sendClaudeApiRequest({
      secret,
      sessionId: uniqueId('session'),
      model: sonnetModel,
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      at: hoursAgo(2)
    });

    let summaryOf = async () => {
      let list = await agentTracking().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      });
      expect(list.items).toHaveLength(1);

      let session = await agentTracking().session.get({
        organizationId: organization.id,
        sessionKey: list.items[0]!.sessionKey
      });
      expect(session.summary).toBeTruthy();

      return session.summary!;
    };

    let listed = await eventually(
      async () => {
        let summary = await summaryOf();
        expect(summary.costComputedUsd).toBe('4.5');

        return summary;
      },
      { timeoutMs: 60_000 }
    );
    expect(listed.costContractUsd).toBeNull();
    expect(listed.costUsd).toBe('4.5');
    expect(listed.models[0]!.overrideId).toBeNull();

    let discount = await agentTracking().pricing.overrides.create({
      organizationId: organization.id,
      name: 'Enterprise discount',
      target: 'model',
      targetId: 'claude-sonnet-4-5',
      kind: 'multiplier',
      multiplier: 0.8,
      validFrom: hoursAgo(24)
    });

    let discounted = await eventually(
      async () => {
        let summary = await summaryOf();
        expect(summary.costContractUsd).toBe('3.6');

        return summary;
      },
      { timeoutMs: 60_000 }
    );
    expect(discounted.costComputedUsd).toBe('4.5');
    expect(discounted.costUsd).toBe('3.6');
    expect(discounted.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      overrideId: discount.id,
      costComputedUsd: '4.5',
      costContractUsd: '3.6'
    });

    let included = await agentTracking().pricing.overrides.update({
      organizationId: organization.id,
      priceOverrideId: discount.id,
      kind: 'included'
    });
    expect(included).toMatchObject({ kind: 'included', multiplier: null });

    let covered = await eventually(
      async () => {
        let summary = await summaryOf();
        expect(summary.costContractUsd).toBe('0');

        return summary;
      },
      { timeoutMs: 60_000 }
    );
    expect(covered.costUsd).toBe('0');

    await agentTracking().pricing.overrides.archive({
      organizationId: organization.id,
      priceOverrideId: discount.id
    });

    let reverted = await eventually(
      async () => {
        let summary = await summaryOf();
        expect(summary.costContractUsd).toBeNull();

        return summary;
      },
      { timeoutMs: 60_000 }
    );
    expect(reverted.costUsd).toBe('4.5');
    expect(reverted.models[0]!.overrideId).toBeNull();
  });

  it('manages overrides through every pricing endpoint', async () => {
    await importKnowledge();

    let organization = await createOrganization();
    let project = await createProject(organization);
    let other = await createOrganization();

    let created = await agentTracking().pricing.overrides.create({
      organizationId: organization.id,
      name: 'Bedrock half price',
      reason: 'Negotiated contract',
      target: 'vendor',
      targetId: 'anthropic',
      kind: 'multiplier',
      multiplier: 0.5,
      priority: 5,
      createdBy: 'e2e@example.com',
      validFrom: hoursAgo(24)
    });
    expect(created).toMatchObject({
      object: 'agent_tracking#price_override',
      name: 'Bedrock half price',
      reason: 'Negotiated contract',
      projectId: null,
      target: 'vendor',
      targetId: 'anthropic',
      vendorId: null,
      kind: 'multiplier',
      multiplier: '0.5',
      rates: null,
      priority: 5,
      validTo: null,
      createdBy: 'e2e@example.com',
      archivedAt: null
    });
    expect(created.id.startsWith('atpo_')).toBe(true);

    let projectRates = await agentTracking().pricing.overrides.create({
      organizationId: organization.id,
      projectId: project.id,
      name: 'Project rates',
      target: 'offering',
      targetId: sonnetOfferingId,
      kind: 'rates',
      rates: textPricing(1),
      validFrom: hoursAgo(24)
    });
    expect(projectRates).toMatchObject({ projectId: project.id, kind: 'rates' });

    let fetched = await agentTracking().pricing.overrides.get({
      organizationId: organization.id,
      priceOverrideId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let updated = await agentTracking().pricing.overrides.update({
      organizationId: organization.id,
      priceOverrideId: created.id,
      name: 'Anthropic half price',
      priority: 10
    });
    expect(updated).toMatchObject({
      name: 'Anthropic half price',
      priority: 10,
      multiplier: '0.5'
    });

    let listed = await agentTracking().pricing.overrides.list({
      organizationId: organization.id
    });
    expect(listed.items.map(item => item.id).sort()).toEqual(
      [created.id, projectRates.id].sort()
    );

    let filtered = await agentTracking().pricing.overrides.list({
      organizationId: organization.id,
      kinds: ['rates']
    });
    expect(filtered.items.map(item => item.id)).toEqual([projectRates.id]);

    let orgPrice = await agentTracking().pricing.effective({
      organizationId: organization.id,
      modelId: 'claude-sonnet-4-5'
    });
    expect(orgPrice).toMatchObject({
      object: 'agent_tracking#pricing_effective',
      modelId: 'claude-sonnet-4-5',
      projectId: null,
      list: { object: 'agent_tracking#knowledge_price_at', modelId: 'claude-sonnet-4-5' },
      override: { id: created.id },
      effective: { basis: 'multiplier' }
    });
    expect(orgPrice.effective.pricing?.text?.input).toBeCloseTo(1.5);
    expect(orgPrice.effective.pricing?.text?.output).toBeCloseTo(7.5);

    let projectPrice = await agentTracking().pricing.effective({
      organizationId: organization.id,
      projectId: project.id,
      offeringId: sonnetOfferingId
    });
    expect(projectPrice).toMatchObject({
      projectId: project.id,
      override: { id: projectRates.id },
      effective: { basis: 'rates', pricing: textPricing(1) }
    });

    let rawPrice = await agentTracking().pricing.effective({
      organizationId: organization.id,
      raw: sonnetModel,
      provider: 'anthropic',
      agent: 'claude-code',
      at: hoursAgo(48)
    });
    expect(rawPrice).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      override: null,
      effective: { basis: 'list' }
    });

    let archived = await agentTracking().pricing.overrides.archive({
      organizationId: organization.id,
      priceOverrideId: projectRates.id
    });
    expect(archived.archivedAt).not.toBeNull();

    let active = await agentTracking().pricing.overrides.list({
      organizationId: organization.id
    });
    expect(active.items.map(item => item.id)).toEqual([created.id]);

    let everything = await agentTracking().pricing.overrides.list({
      organizationId: organization.id,
      includeArchived: true
    });
    expect(everything.items).toHaveLength(2);

    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.update({
          organizationId: organization.id,
          priceOverrideId: projectRates.id,
          name: 'Too late'
        })
      )
    ).toBe('bad_request');

    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.get({
          organizationId: other.id,
          priceOverrideId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.archive({
          organizationId: other.id,
          priceOverrideId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      (await agentTracking().pricing.overrides.list({ organizationId: other.id })).items
    ).toHaveLength(0);

    let otherProject = await createProject(other);
    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.create({
          organizationId: organization.id,
          projectId: otherProject.id,
          name: 'Foreign project',
          target: 'all',
          kind: 'included'
        })
      )
    ).toBe('not_found');
  });

  it('limits overrides to billing modes', async () => {
    await importKnowledge();

    let organization = await createOrganization();

    let apiOnly = await agentTracking().pricing.overrides.create({
      organizationId: organization.id,
      name: 'API discount',
      target: 'model',
      targetId: 'claude-sonnet-4-5',
      billingModes: ['api', 'api'],
      kind: 'multiplier',
      multiplier: 0.5,
      validFrom: hoursAgo(24)
    });
    expect(apiOnly).toMatchObject({ billingModes: ['api'], kind: 'multiplier' });

    let fetched = await agentTracking().pricing.overrides.get({
      organizationId: organization.id,
      priceOverrideId: apiOnly.id
    });
    expect(fetched.billingModes).toEqual(['api']);

    let priceFor = (billingMode?: 'api' | 'included' | 'unknown') =>
      agentTracking().pricing.effective({
        organizationId: organization.id,
        modelId: 'claude-sonnet-4-5',
        ...(billingMode ? { billingMode } : {})
      });

    let api = await priceFor('api');
    expect(api).toMatchObject({
      billingMode: 'api',
      override: { id: apiOnly.id, billingModes: ['api'] },
      effective: { basis: 'multiplier' }
    });
    expect(api.effective.pricing?.text?.input).toBeCloseTo(1.5);

    expect(await priceFor('included')).toMatchObject({
      billingMode: 'included',
      override: null,
      effective: { basis: 'list' }
    });
    expect(await priceFor()).toMatchObject({ billingMode: 'unknown', override: null });

    let plan = await agentTracking().pricing.overrides.update({
      organizationId: organization.id,
      priceOverrideId: apiOnly.id,
      billingModes: ['unknown', 'included'],
      kind: 'included'
    });
    expect(plan).toMatchObject({ billingModes: ['included', 'unknown'], kind: 'included' });

    expect(await priceFor('included')).toMatchObject({
      override: { id: apiOnly.id },
      effective: { basis: 'included' }
    });
    expect(await priceFor('unknown')).toMatchObject({ override: { id: apiOnly.id } });
    expect(await priceFor('api')).toMatchObject({ override: null });

    let any = await agentTracking().pricing.overrides.update({
      organizationId: organization.id,
      priceOverrideId: apiOnly.id,
      billingModes: []
    });
    expect(any.billingModes).toEqual([]);
    expect(await priceFor('api')).toMatchObject({ override: { id: apiOnly.id } });

    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.create({
          organizationId: organization.id,
          name: 'Invalid mode',
          target: 'all',
          billingModes: ['seat' as 'api'],
          kind: 'included'
        })
      )
    ).toBe('invalid_data');
    expect(
      await rpcErrorCode(
        agentTracking().pricing.overrides.create({
          organizationId: organization.id,
          name: 'Too many modes',
          target: 'all',
          billingModes: ['api', 'api', 'api', 'api', 'api'],
          kind: 'included'
        })
      )
    ).toBe('invalid_data');
    expect(
      await rpcErrorCode(
        agentTracking().pricing.effective({
          organizationId: organization.id,
          modelId: 'claude-sonnet-4-5',
          billingMode: 'seat' as 'api'
        })
      )
    ).toBe('invalid_data');
  });

  it('rejects invalid overrides', async () => {
    await importKnowledge();

    let organization = await createOrganization();
    let create = (input: Partial<CreateInput>) =>
      agentTracking().pricing.overrides.create({
        organizationId: organization.id,
        name: 'Invalid',
        target: 'all',
        kind: 'included',
        ...input
      });

    expect(await rpcErrorCode(create({ kind: 'multiplier' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ kind: 'multiplier', multiplier: -1 }))).toBe(
      'bad_request'
    );
    expect(await rpcErrorCode(create({ kind: 'rates' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ targetId: 'claude-sonnet-4-5' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ target: 'model' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ target: 'model', targetId: 'no-such-model' }))).toBe(
      'bad_request'
    );
    expect(await rpcErrorCode(create({ vendorId: 'no-such-vendor' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ validFrom: hoursAgo(1), validTo: hoursAgo(2) }))).toBe(
      'bad_request'
    );
    expect(
      await rpcErrorCode(
        agentTracking().pricing.effective({
          organizationId: organization.id,
          modelId: 'no-such-model'
        })
      )
    ).toBe('not_found');
  });
});
