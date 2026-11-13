import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { textPricing } from '../src/knowledge/tests/fixture';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import {
  createOrganization,
  createProject,
  createToken,
  groundstation,
  rpcErrorCode
} from './support';

let hourMs = 60 * 60 * 1000;
let sonnetModel = 'claude-sonnet-4-5-20250929';
let sonnetOfferingId = 'anthropic:claude-sonnet-4-5-20250929';

type CreateInput = Parameters<
  ReturnType<typeof groundstation>['pricing']['overrides']['create']
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
      let list = await groundstation().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      });
      expect(list.items).toHaveLength(1);

      let session = await groundstation().session.get({
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

    let discount = await groundstation().pricing.overrides.create({
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

    let included = await groundstation().pricing.overrides.update({
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

    await groundstation().pricing.overrides.archive({
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

    let created = await groundstation().pricing.overrides.create({
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
      object: 'groundstation#price_override',
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
    expect(created.id.startsWith('gpo_')).toBe(true);

    let projectRates = await groundstation().pricing.overrides.create({
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

    let fetched = await groundstation().pricing.overrides.get({
      organizationId: organization.id,
      priceOverrideId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let updated = await groundstation().pricing.overrides.update({
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

    let listed = await groundstation().pricing.overrides.list({
      organizationId: organization.id
    });
    expect(listed.items.map(item => item.id).sort()).toEqual(
      [created.id, projectRates.id].sort()
    );

    let filtered = await groundstation().pricing.overrides.list({
      organizationId: organization.id,
      kinds: ['rates']
    });
    expect(filtered.items.map(item => item.id)).toEqual([projectRates.id]);

    let orgPrice = await groundstation().pricing.effective({
      organizationId: organization.id,
      modelId: 'claude-sonnet-4-5'
    });
    expect(orgPrice).toMatchObject({
      object: 'groundstation#pricing_effective',
      modelId: 'claude-sonnet-4-5',
      projectId: null,
      list: { object: 'groundstation#knowledge_price_at', modelId: 'claude-sonnet-4-5' },
      override: { id: created.id },
      effective: { basis: 'multiplier' }
    });
    expect(orgPrice.effective.pricing?.text?.input).toBeCloseTo(1.5);
    expect(orgPrice.effective.pricing?.text?.output).toBeCloseTo(7.5);

    let projectPrice = await groundstation().pricing.effective({
      organizationId: organization.id,
      projectId: project.id,
      offeringId: sonnetOfferingId
    });
    expect(projectPrice).toMatchObject({
      projectId: project.id,
      override: { id: projectRates.id },
      effective: { basis: 'rates', pricing: textPricing(1) }
    });

    let rawPrice = await groundstation().pricing.effective({
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

    let archived = await groundstation().pricing.overrides.archive({
      organizationId: organization.id,
      priceOverrideId: projectRates.id
    });
    expect(archived.archivedAt).not.toBeNull();

    let active = await groundstation().pricing.overrides.list({
      organizationId: organization.id
    });
    expect(active.items.map(item => item.id)).toEqual([created.id]);

    let everything = await groundstation().pricing.overrides.list({
      organizationId: organization.id,
      includeArchived: true
    });
    expect(everything.items).toHaveLength(2);

    expect(
      await rpcErrorCode(
        groundstation().pricing.overrides.update({
          organizationId: organization.id,
          priceOverrideId: projectRates.id,
          name: 'Too late'
        })
      )
    ).toBe('bad_request');

    expect(
      await rpcErrorCode(
        groundstation().pricing.overrides.get({
          organizationId: other.id,
          priceOverrideId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        groundstation().pricing.overrides.archive({
          organizationId: other.id,
          priceOverrideId: created.id
        })
      )
    ).toBe('not_found');
    expect(
      (await groundstation().pricing.overrides.list({ organizationId: other.id })).items
    ).toHaveLength(0);

    let otherProject = await createProject(other);
    expect(
      await rpcErrorCode(
        groundstation().pricing.overrides.create({
          organizationId: organization.id,
          projectId: otherProject.id,
          name: 'Foreign project',
          target: 'all',
          kind: 'included'
        })
      )
    ).toBe('not_found');
  });

  it('rejects invalid overrides', async () => {
    await importKnowledge();

    let organization = await createOrganization();
    let create = (input: Partial<CreateInput>) =>
      groundstation().pricing.overrides.create({
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
        groundstation().pricing.effective({
          organizationId: organization.id,
          modelId: 'no-such-model'
        })
      )
    ).toBe('not_found');
  });
});
