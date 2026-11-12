import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, slates, getTenantForSlates } = vi.hoisted(() => ({
  db: {
    slateCallbackInstance: { findUnique: vi.fn(), create: vi.fn() },
    slateCallback: { findUniqueOrThrow: vi.fn() },
    slateInstance: { findUniqueOrThrow: vi.fn() },
    slateAuthConfig: { findUniqueOrThrow: vi.fn() },
    slateWebhookRegistration: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    slate: { findUniqueOrThrow: vi.fn() },
    slateOAuthCredentials: { findUniqueOrThrow: vi.fn(), findMany: vi.fn() }
  },
  slates: {
    callbackInstance: { create: vi.fn(), get: vi.fn() },
    slateWebhookRegistration: {
      delete: vi.fn(),
      create: vi.fn(),
      getDeliveryConfigsServingOAuthCredentials: vi.fn()
    }
  },
  getTenantForSlates: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({ db, snowflake: { nextId: () => 100n } }));
vi.mock('@metorial-subspace/provider-utils', () => ({ IProviderCallbacks: class {} }));
vi.mock('../client', () => ({ slates, getTenantForSlates }));

import { ProviderCallbacks } from './callback';

let input = () => ({
  tenant: { oid: 1n, projectOid: 2n },
  callback: { oid: 3n, tenantOid: 1n },
  callbackInstance: {
    oid: 4n,
    tenantOid: 1n,
    callbackOid: 3n,
    providerConfigVersionOid: 5n,
    providerAuthConfigVersionOid: 6n,
    triggerGroupSelections: { 'spreadsheet-changes': { spreadsheetId: 'sheet-1' } }
  },
  configVersion: { oid: 5n, slateInstanceOid: 7n },
  authConfigVersion: { oid: 6n, slateAuthConfigOid: 8n }
});

describe('callback instance selection propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.slateCallbackInstance.findUnique.mockResolvedValue(null);
    db.slateCallback.findUniqueOrThrow.mockResolvedValue({
      oid: 9n,
      id: 'callback-1',
      slateOid: 10n
    });
    db.slateInstance.findUniqueOrThrow.mockResolvedValue({ oid: 7n, id: 'instance-1' });
    db.slateAuthConfig.findUniqueOrThrow.mockResolvedValue({ oid: 8n, id: 'auth-1' });
    getTenantForSlates.mockResolvedValue({ id: 'tenant-1' });
    slates.callbackInstance.create.mockResolvedValue({
      id: 'callback-instance-1',
      triggerRegistration: { id: 'registration-1' }
    });
  });

  it('passes persisted selections and authentication to the hub', async () => {
    let data = input();

    await new ProviderCallbacks({} as any).createCallbackInstance(data as any);

    expect(slates.callbackInstance.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      callbackId: 'callback-1',
      slateInstanceId: 'instance-1',
      authConfigId: 'auth-1',
      triggerGroupSelections: data.callbackInstance.triggerGroupSelections
    });
    expect(db.slateInstance.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { oid: 7n, tenantOid: 1n, slateOid: 10n }
    });
    expect(db.slateAuthConfig.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { oid: 8n, tenantOid: 1n, slateOid: 10n }
    });
  });

  it('preserves existing calls without selections', async () => {
    let data = input();
    (data.callbackInstance as any).triggerGroupSelections = null;

    await new ProviderCallbacks({} as any).createCallbackInstance(data as any);

    expect(slates.callbackInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({ triggerGroupSelections: undefined, authConfigId: 'auth-1' })
    );
  });

  it.each(['tenant', 'callback', 'config', 'auth'])(
    'rejects a mismatched %s before calling the hub',
    async mismatch => {
      let data = input();
      if (mismatch === 'tenant') data.callbackInstance.tenantOid = 999n;
      if (mismatch === 'callback') data.callbackInstance.callbackOid = 999n;
      if (mismatch === 'config') data.callbackInstance.providerConfigVersionOid = 999n;
      if (mismatch === 'auth') data.callbackInstance.providerAuthConfigVersionOid = 999n;

      await expect(
        new ProviderCallbacks({} as any).createCallbackInstance(data as any)
      ).rejects.toThrow();

      expect(slates.callbackInstance.create).not.toHaveBeenCalled();
      expect(db.slateCallbackInstance.findUnique).not.toHaveBeenCalled();
    }
  );

  it('returns the selectable trigger groups of an instance created by an earlier attempt', async () => {
    let selectableTriggerGroups = [
      {
        key: 'spreadsheet-changes',
        name: 'Spreadsheet changes',
        description: null,
        selectionSchema: { type: 'object' },
        status: 'active'
      }
    ];
    db.slateCallbackInstance.findUnique.mockResolvedValue({
      id: 'callback-instance-1',
      slateCallback: { id: 'callback-1' }
    });
    slates.callbackInstance.get.mockResolvedValue({
      id: 'callback-instance-1',
      selectableTriggerGroups
    });

    let res = await new ProviderCallbacks({} as any).createCallbackInstance(input() as any);

    expect(res).toEqual({ selectableTriggerGroups });
    expect(slates.callbackInstance.get).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1'
    });
    expect(slates.callbackInstance.create).not.toHaveBeenCalled();
  });

  it('does not silently drop authentication from another backend', async () => {
    let data = input();
    (data.authConfigVersion as any).slateAuthConfigOid = null;

    await expect(
      new ProviderCallbacks({} as any).createCallbackInstance(data as any)
    ).rejects.toThrow();

    expect(slates.callbackInstance.create).not.toHaveBeenCalled();
  });
});

describe('webhook registration creation', () => {
  let registrationInput = (authCredentials: Record<string, unknown> | null) => ({
    tenant: { oid: 1n, projectOid: 2n },
    providerVariant: { slateOid: 10n },
    authCredentials,
    webhookRegistration: {
      oid: 20n,
      name: 'Delivery Setup',
      description: null,
      metadata: null
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getTenantForSlates.mockResolvedValue({ id: 'tenant-1' });
    db.slate.findUniqueOrThrow.mockResolvedValue({ oid: 10n, id: 'slate-1' });
    db.slateOAuthCredentials.findUniqueOrThrow.mockResolvedValue({ oid: 30n, id: 'soc_own' });
    slates.slateWebhookRegistration.create.mockResolvedValue({
      webhookRegistration: {
        id: 'hub-registration-1',
        triggerGroupKey: 'mail',
        urlKey: 'whk_1',
        receiveUrl: 'https://hooks.example.com/receive/whk_1'
      },
      webhookSetupDocument: 'Do this.',
      webhookSetupSchema: { type: 'object' }
    });
  });

  it('names the OAuth credentials a delivery setup is for', async () => {
    let result = await new ProviderCallbacks({} as any).createWebhookRegistration(
      registrationInput({ oid: 40n, slateCredentialsOid: 30n }) as any
    );

    expect(db.slateOAuthCredentials.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { oid: 30n, tenantOid: 1n, slateOid: 10n }
    });
    expect(slates.slateWebhookRegistration.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      slateId: 'slate-1',
      name: 'Delivery Setup',
      description: undefined,
      metadata: undefined,
      deliveryConfigOAuthCredentialsId: 'soc_own'
    });
    expect(result.setup).toEqual({ document: 'Do this.', schema: { type: 'object' } });
  });

  it('names no OAuth credentials for a webhook receiver', async () => {
    await new ProviderCallbacks({} as any).createWebhookRegistration(
      registrationInput(null) as any
    );

    expect(db.slateOAuthCredentials.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(slates.slateWebhookRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryConfigOAuthCredentialsId: undefined })
    );
  });

  it('rejects credentials that are not backed by this backend before calling the hub', async () => {
    await expect(
      new ProviderCallbacks({} as any).createWebhookRegistration(
        registrationInput({ oid: 40n, slateCredentialsOid: null }) as any
      )
    ).rejects.toMatchObject({
      data: { code: 'auth_credentials_backend_mismatch', status: 400 }
    });

    expect(slates.slateWebhookRegistration.create).not.toHaveBeenCalled();
  });

  it('reports a live setup for the same OAuth app as a conflict', async () => {
    slates.slateWebhookRegistration.create.mockRejectedValue(
      new ServiceError(conflictError({ code: 'delivery_config_already_exists' }))
    );

    await expect(
      new ProviderCallbacks({} as any).createWebhookRegistration(
        registrationInput({ oid: 40n, slateCredentialsOid: 30n }) as any
      )
    ).rejects.toMatchObject({
      data: {
        code: 'delivery_setup_already_exists',
        status: 409,
        message:
          'A delivery setup already exists for this OAuth app. Finish or delete it before creating another one.'
      }
    });

    expect(db.slateWebhookRegistration.create).not.toHaveBeenCalled();
  });

  it('passes any other hub rejection through unchanged', async () => {
    let rejection = new ServiceError(
      badRequestError({ code: 'invalid_oauth_credentials_id' })
    );
    slates.slateWebhookRegistration.create.mockRejectedValue(rejection);

    await expect(
      new ProviderCallbacks({} as any).createWebhookRegistration(
        registrationInput({ oid: 40n, slateCredentialsOid: 30n }) as any
      )
    ).rejects.toBe(rejection);
  });
});

describe('webhook registration deletion', () => {
  let data = { tenant: { oid: 1n }, webhookRegistration: { oid: 20n } };

  beforeEach(() => {
    vi.clearAllMocks();
    getTenantForSlates.mockResolvedValue({ id: 'tenant-1' });
    db.slateWebhookRegistration.findUnique.mockResolvedValue({ id: 'hub-registration-1' });
  });

  it('deletes the hub registration', async () => {
    await new ProviderCallbacks({} as any).deleteWebhookRegistration(data as any);

    expect(slates.slateWebhookRegistration.delete).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      webhookRegistrationId: 'hub-registration-1'
    });
  });

  it('treats a hub registration that is already gone as deleted', async () => {
    slates.slateWebhookRegistration.delete.mockRejectedValue(
      new ServiceError(notFoundError('webhook_registration'))
    );

    await expect(
      new ProviderCallbacks({} as any).deleteWebhookRegistration(data as any)
    ).resolves.toEqual({});
  });

  it('reports any other hub failure so the delete is retried', async () => {
    slates.slateWebhookRegistration.delete.mockRejectedValue(new Error('hub unavailable'));

    await expect(
      new ProviderCallbacks({} as any).deleteWebhookRegistration(data as any)
    ).rejects.toThrow('hub unavailable');
  });
});

describe('delivery setups serving OAuth credentials', () => {
  let tenant = { oid: 1n };

  let serving = (authCredentials: Record<string, unknown>[]) =>
    new ProviderCallbacks({} as any).listDeliverySetupsServingAuthCredentials({
      tenant,
      authCredentials
    } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    getTenantForSlates.mockResolvedValue({ id: 'tenant-1' });
    db.slateOAuthCredentials.findMany.mockResolvedValue([{ id: 'soc_a' }, { id: 'soc_b' }]);
    slates.slateWebhookRegistration.getDeliveryConfigsServingOAuthCredentials.mockResolvedValue(
      [{ id: 'hub-registration-1' }, { id: 'hub-registration-2' }]
    );
    db.slateWebhookRegistration.findMany.mockResolvedValue([{ webhookRegistrationOid: 20n }]);
  });

  it("asks the hub through the tenant's Slates credentials and maps its configs to their setups", async () => {
    let result = await serving([
      { oid: 40n, slateCredentialsOid: 30n },
      { oid: 41n, slateCredentialsOid: 31n },
      { oid: 42n, slateCredentialsOid: null }
    ]);

    expect(db.slateOAuthCredentials.findMany).toHaveBeenCalledWith({
      where: { oid: { in: [30n, 31n] }, tenantOid: 1n },
      select: { id: true }
    });
    expect(
      slates.slateWebhookRegistration.getDeliveryConfigsServingOAuthCredentials
    ).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      slateOAuthCredentialsIds: ['soc_a', 'soc_b']
    });
    expect(db.slateWebhookRegistration.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['hub-registration-1', 'hub-registration-2'] },
        tenantOid: 1n,
        webhookRegistrationOid: { not: null }
      },
      select: { webhookRegistrationOid: true }
    });
    expect(result).toEqual({ webhookRegistrationOids: [20n] });
  });

  it('asks the hub in pages it accepts', async () => {
    db.slateOAuthCredentials.findMany.mockResolvedValue(
      Array.from({ length: 150 }, (_, index) => ({ id: `soc_${index}` }))
    );

    await serving([{ oid: 40n, slateCredentialsOid: 30n }]);

    let pages =
      slates.slateWebhookRegistration.getDeliveryConfigsServingOAuthCredentials.mock.calls.map(
        ([input]) => input.slateOAuthCredentialsIds.length
      );
    expect(pages).toEqual([100, 50]);
    expect(db.slateWebhookRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: [
              'hub-registration-1',
              'hub-registration-2',
              'hub-registration-1',
              'hub-registration-2'
            ]
          }
        })
      })
    );
  });

  it('asks the hub nothing for credentials without Slates credentials', async () => {
    expect(await serving([{ oid: 42n, slateCredentialsOid: null }])).toEqual({
      webhookRegistrationOids: []
    });

    expect(db.slateOAuthCredentials.findMany).not.toHaveBeenCalled();
    expect(
      slates.slateWebhookRegistration.getDeliveryConfigsServingOAuthCredentials
    ).not.toHaveBeenCalled();
  });

  it("asks the hub nothing when none of the Slates credentials are the tenant's", async () => {
    db.slateOAuthCredentials.findMany.mockResolvedValue([]);

    expect(await serving([{ oid: 40n, slateCredentialsOid: 30n }])).toEqual({
      webhookRegistrationOids: []
    });

    expect(
      slates.slateWebhookRegistration.getDeliveryConfigsServingOAuthCredentials
    ).not.toHaveBeenCalled();
  });
});
