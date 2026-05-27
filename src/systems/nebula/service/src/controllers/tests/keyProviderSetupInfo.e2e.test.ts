import { beforeEach, describe, expect, it } from 'vitest';
import { nebulaClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('key provider setup info', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns local setup info without a consumer token', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-setup-local',
      name: 'Tenant Setup Local'
    });

    let setupInfo = await nebulaClient.keyProvider.getSetupInfo({
      tenantId: tenant.id
    });

    expect(setupInfo).toMatchObject({
      object: 'nebula#key_provider_setup_info'
    });
    expect(setupInfo.steps.length).toBeGreaterThan(0);
    expect(setupInfo.steps.some(step => step.markdown?.includes('keyProvider.import'))).toBe(
      true
    );
    expect(
      setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'testKeyId'))
    ).toBe(true);
    expect(
      setupInfo.steps.some(step =>
        step.inputs?.some(input => input.key === 'localMasterSecretRef')
      )
    ).toBe(true);
    expect(
      setupInfo.steps.some(step => step.description.includes('LOCAL_MASTER_SECRET'))
    ).toBe(true);
    expect(setupInfo.steps.some(step => step.description.includes('production'))).toBe(true);
  });
});
