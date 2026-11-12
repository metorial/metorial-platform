import { notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, slates, getTenantForSlates } = vi.hoisted(() => ({
  db: {
    slateCallbackInstance: { findUnique: vi.fn(), create: vi.fn() },
    slateCallback: { findUniqueOrThrow: vi.fn() },
    slateInstance: { findUniqueOrThrow: vi.fn() },
    slateAuthConfig: { findUniqueOrThrow: vi.fn() },
    slateWebhookRegistration: { findUnique: vi.fn() }
  },
  slates: {
    callbackInstance: { create: vi.fn(), get: vi.fn() },
    slateWebhookRegistration: { delete: vi.fn() }
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
