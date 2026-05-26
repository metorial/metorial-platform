import { describe, expect, it, beforeEach } from 'vitest';
import { AwsKmsKeyProviderAdapter } from '../../adapters/aws-kms';
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
    expect(setupInfo.steps.some(step => step.markdown?.includes('keyProvider.import'))).toBe(true);
    expect(setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'testKeyId'))).toBe(true);
    expect(
      setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'localMasterSecretRef'))
    ).toBe(true);
    expect(setupInfo.steps.some(step => step.description.includes('LOCAL_MASTER_SECRET'))).toBe(true);
    expect(setupInfo.steps.some(step => step.description.includes('production'))).toBe(true);
  });

  it('generates AWS KMS setup info with role ARN and required actions', async () => {
    let adapter = new AwsKmsKeyProviderAdapter();
    let roleArn = 'arn:aws:iam::123456789012:role/metorial-test-nebula-task-role';
    let setupInfo = await adapter.getSetupInfo({
      tenantId: 'ntn_test',
      tenantIdentifier: 'tenant-setup-aws',
      region: 'us-east-1',
      keyId: 'arn:aws:kms:us-east-1:123456789012:key/example',
      roleArn
    });

    expect(setupInfo.steps.length).toBeGreaterThan(0);
    expect(setupInfo.steps.some(step => (step.markdown?.length ?? 0) > 0)).toBe(true);
    expect(setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'keyId'))).toBe(true);
    expect(
      setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'region'))
    ).toBe(true);
    expect(setupInfo.steps.some(step => step.markdown?.includes(roleArn))).toBe(true);
    expect(setupInfo.steps.some(step => step.markdown?.includes('kms:DescribeKey'))).toBe(true);
    expect(setupInfo.steps.some(step => step.markdown?.includes('kms:GenerateDataKey'))).toBe(true);
    expect(setupInfo.steps.some(step => step.markdown?.includes('kms:Decrypt'))).toBe(true);
    expect(
      setupInfo.steps.some(step => step.markdown?.includes('"metorial-system": "metorial"'))
    ).toBe(true);
  });
});
