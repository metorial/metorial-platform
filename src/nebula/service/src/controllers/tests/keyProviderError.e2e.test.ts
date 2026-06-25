import { beforeEach, describe, expect, it } from 'vitest';
import { keyProviderErrorService } from '../../services';
import { nebulaClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

describe('key provider errors', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('dedupes provider errors per day and increments count', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-errors',
      name: 'Tenant Errors'
    });
    let provider = await nebulaClient.keyProvider.import({
      tenantId: tenant.id,
      keyInput: {}
    });

    let dbTenant = await testDb.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    let dbProvider = await testDb.keyProvider.findUniqueOrThrow({ where: { id: provider.id } });

    await keyProviderErrorService.recordKeyProviderError({
      tenant: dbTenant,
      keyProvider: dbProvider,
      operation: 'decrypt_data_key',
      code: 'DisabledException',
      message: 'KMS key is disabled'
    });
    await keyProviderErrorService.recordKeyProviderError({
      tenant: dbTenant,
      keyProvider: dbProvider,
      operation: 'decrypt_data_key',
      code: 'DisabledException',
      message: 'KMS key is disabled'
    });

    let errors = await testDb.keyError.findMany();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      count: 2,
      code: 'DisabledException',
      sampleMessage: 'KMS key is disabled'
    });
  });
});
