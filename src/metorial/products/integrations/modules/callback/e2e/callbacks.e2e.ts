import {
  createRemoteProvider,
  eventually,
  expectError,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { createLock } from '@lowerdeck/lock';
import { describe, expect, it } from 'vitest';
import { callbackInstanceService, callbackInternalService, callbackService } from '../src';
import { env } from '../src/env';
import {
  createIntegrationInstance,
  createIntegrationProvider,
  enableProviderTriggers,
  findActiveCallbacks,
  markCallbackSynced,
  scopeOf,
  setCallbacks,
  waitForCallbackInstanceSync,
  waitForCallbackSync
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-callback callbacks', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useFixture(async () => {
    let [triggered, plain] = await Promise.all([
      createRemoteProvider(org.clients.instance, { url: server.url }),
      createRemoteProvider(org.clients.instance, { url: server.url })
    ]);
    await enableProviderTriggers(triggered.providerId);

    return { triggered: triggered.providerId, plain: plain.providerId };
  });

  let createCallbackSetup = async () => {
    let created = await createIntegrationProvider(org, {
      providerId: providers.triggered,
      callbacks: true,
      description: 'Callback e2e'
    });
    let integrationProvider = expectOk(created.response);
    let [callback, ...rest] = await findActiveCallbacks(integrationProvider.id);
    expect(rest).toEqual([]);

    return { ...created, integrationProvider, callback: callback! };
  };
  let callbackOnce: ReturnType<typeof createCallbackSetup> | undefined;
  let ensureCallback = () => (callbackOnce ??= createCallbackSetup());

  let createInstanceSetup = async () => {
    let created = await createIntegrationProvider(org, { providerId: providers.triggered });
    let integrationProvider = expectOk(created.response);
    let { integrationInstance, integrationInstanceProvider } = await createIntegrationInstance(
      org,
      { integrationId: created.integration.id, providerId: providers.triggered }
    );

    await setCallbacks(org, integrationProvider.id, 'enabled');
    let [callback] = await findActiveCallbacks(integrationProvider.id);
    let failed = await waitForCallbackSync(callback!.id);

    return {
      ...created,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider,
      callback: failed
    };
  };
  let instanceOnce: ReturnType<typeof createInstanceSetup> | undefined;
  let ensureInstanceSetup = () => (instanceOnce ??= createInstanceSetup());

  it('refuses to enable callbacks for a provider whose type has no triggers', async () => {
    let { response } = await createIntegrationProvider(org, {
      providerId: providers.plain,
      callbacks: true
    });
    expectError(response, 400, 'callbacks_not_supported');

    expect(
      await subspaceDb.callback.count({ where: { provider: { id: providers.plain } } })
    ).toBe(0);
  });

  it('creates a user callback when callbacks are enabled and records that its backend cannot sync it', async () => {
    let { callback, integrationProvider, name } = await ensureCallback();

    expect(callback).toMatchObject({
      status: 'active',
      ownership: 'user',
      name,
      description: 'Callback e2e',
      archivedAt: null
    });

    let synced = await waitForCallbackSync(callback.id);
    expect(synced).toMatchObject({
      syncStatus: 'failed',
      lastSyncErrorCode: 'callbacks_not_supported',
      lastSyncErrorMessage: 'This provider does not support callbacks.',
      lastSyncedAt: null
    });

    let scope = await scopeOf(org);
    let fetched = await callbackService.getCallbackById({
      instance: scope.instance,
      callbackId: callback.id
    });
    expect(fetched).toMatchObject({
      id: callback.id,
      integrationProvider: expect.objectContaining({ id: integrationProvider.id }),
      provider: expect.objectContaining({ id: providers.triggered })
    });
  });

  it('reconciles an integration provider without creating a second callback', async () => {
    let { callback, integrationProvider } = await ensureCallback();

    let first = await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });
    let second = await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });

    expect(first?.id).toBe(callback.id);
    expect(second?.id).toBe(callback.id);
    expect(ids(await findActiveCallbacks(integrationProvider.id))).toEqual([callback.id]);
  });

  it('keeps the requested name when a background reconcile races the callback creation', async () => {
    let created = await createIntegrationProvider(org, { providerId: providers.triggered });
    let integrationProvider = expectOk(created.response);
    let reconcileLock = createLock({
      name: 'sub/cb/reconcile/callback/lock',
      redisUrl: env.service.REDIS_URL
    });

    let { creating } = await reconcileLock.usingLock(integrationProvider.id, async () => {
      let creating = org.clients.instance.post('/callbacks', {
        integration_id: created.integration.id,
        integration_provider_id: integrationProvider.id,
        name: 'Requested callback',
        description: 'Requested description'
      });
      await new Promise(resolve => setTimeout(resolve, 1_000));

      let pending = await subspaceDb.integrationProvider.findUniqueOrThrow({
        where: { id: integrationProvider.id }
      });
      expect(pending.areCallbacksEnabled).toBe(false);

      return { creating };
    });
    let background = callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });

    let callback = expectOk(await creating);
    await background;

    expect(callback).toMatchObject({
      name: 'Requested callback',
      description: 'Requested description'
    });
    expect(ids(await findActiveCallbacks(integrationProvider.id))).toEqual([callback.id]);
  });

  it('lists callbacks by integration, provider, status and search', async () => {
    let { callback, integration, integrationProvider, name } = await ensureCallback();
    let scope = await scopeOf(org);
    let list = async (
      input: Omit<Parameters<typeof callbackService.listCallbacks>[0], 'instance'>
    ) =>
      ids(
        await firstPage(
          await callbackService.listCallbacks({ instance: scope.instance, ...input })
        )
      );

    expect(await list({ ids: [callback.id] })).toEqual([callback.id]);
    expect(await list({ integrationIds: [integration.id] })).toEqual([callback.id]);
    expect(await list({ integrationProviderIds: [integrationProvider.id] })).toEqual([
      callback.id
    ]);
    expect(await list({ providerIds: [providers.triggered] })).toContain(callback.id);
    expect(await list({ providerIds: [providers.plain] })).toEqual([]);
    expect(await list({ ids: [callback.id], status: ['archived'] })).toEqual([]);
    expect(await list({ integrationIds: [uniqueId('missing-integration')] })).toEqual([]);

    await eventually(
      async () => {
        expect(await list({ search: name })).toEqual([callback.id]);
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
  });

  it('updates the name, description and metadata of an active callback', async () => {
    let { callback } = await ensureCallback();
    let scope = await scopeOf(org);
    let name = uniqueId('renamed-callback');

    let current = await callbackService.getCallbackById({
      instance: scope.instance,
      callbackId: callback.id
    });
    let updated = await callbackService.updateCallback({
      instance: scope.instance,
      auditScope: scope.auditScope,
      callback: current,
      input: { name, description: null, metadata: { team: 'e2e' } }
    });
    expect(updated).toMatchObject({
      id: callback.id,
      name,
      description: null,
      metadata: { team: 'e2e' },
      status: 'active'
    });

    expect(
      await callbackService.getCallbackById({
        instance: scope.instance,
        callbackId: callback.id
      })
    ).toMatchObject({ name, metadata: { team: 'e2e' } });

    await eventually(
      async () => {
        expect(
          ids(
            await firstPage(
              await callbackService.listCallbacks({ instance: scope.instance, search: name })
            )
          )
        ).toEqual([callback.id]);
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
  });

  it('provisions a callback instance only once the callback is synced', async () => {
    let { callback, integrationInstance, integrationInstanceProvider } =
      await ensureInstanceSetup();
    let scope = await scopeOf(org);

    expect(callback.syncStatus).toBe('failed');
    await new Promise(resolve => setTimeout(resolve, 2_000));
    expect(
      await subspaceDb.callbackInstance.count({ where: { callbackOid: callback.oid } })
    ).toBe(0);

    await markCallbackSynced(callback.id);
    await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
      integrationInstanceProviderId: integrationInstanceProvider.id
    });

    let created = await subspaceDb.callbackInstance.findFirstOrThrow({
      where: { callbackOid: callback.oid }
    });
    expect(created).toMatchObject({
      status: 'active',
      generationStatus: 'provisioning',
      integrationInstanceProviderOid: integrationInstanceProvider.oid,
      isParentDeleted: false
    });
    expect(created.providerConfigVersionOid).not.toBeNull();

    let pushed = await waitForCallbackInstanceSync(created.id);
    expect(pushed).toMatchObject({
      syncStatus: 'failed',
      generationStatus: 'provisioning',
      lastSyncErrorCode: 'callbacks_not_supported'
    });

    await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
      integrationInstanceProviderId: integrationInstanceProvider.id
    });
    expect(
      ids(await subspaceDb.callbackInstance.findMany({ where: { callbackOid: callback.oid } }))
    ).toEqual([created.id]);

    let list = async (
      input: Omit<
        Parameters<typeof callbackInstanceService.listCallbackInstances>[0],
        'instance'
      >
    ) =>
      ids(
        await firstPage(
          await callbackInstanceService.listCallbackInstances({
            instance: scope.instance,
            ...input
          })
        )
      );

    expect(await list({ callbackIds: [callback.id] })).toEqual([]);
    expect(await list({ callbackIds: [callback.id], status: ['active'] })).toEqual([
      created.id
    ]);
    expect(
      await list({ integrationInstanceIds: [integrationInstance.id], status: ['active'] })
    ).toEqual([created.id]);
    expect(
      await list({
        integrationInstanceProviderIds: [integrationInstanceProvider.id],
        status: ['archived']
      })
    ).toEqual([]);

    let fetched = await callbackInstanceService.getCallbackInstanceById({
      instance: scope.instance,
      callbackInstanceId: created.id
    });
    expect(fetched).toMatchObject({
      id: created.id,
      callback: expect.objectContaining({ id: callback.id }),
      integrationInstance: expect.objectContaining({ id: integrationInstance.id })
    });
  });

  it('archives the callback and its instances when callbacks are disabled', async () => {
    let setup = await ensureInstanceSetup();
    let scope = await scopeOf(org);
    let created = await subspaceDb.callbackInstance.findFirst({
      where: { callbackOid: setup.callback.oid }
    });
    if (!created) {
      await markCallbackSynced(setup.callback.id);
      await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
        integrationInstanceProviderId: setup.integrationInstanceProvider.id
      });
    }

    await setCallbacks(org, setup.integrationProvider.id, 'disabled');

    let archived = await eventually(
      async () => {
        let callback = await subspaceDb.callback.findUniqueOrThrow({
          where: { id: setup.callback.id },
          include: { callbackInstances: true }
        });
        expect(callback.status).toBe('archived');
        return callback;
      },
      { timeoutMs: 90_000, intervalMs: 1_000 }
    );
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(archived.callbackInstances).toHaveLength(1);
    expect(archived.callbackInstances[0]).toMatchObject({
      status: 'archived',
      isParentDeleted: true
    });
    expect(archived.callbackInstances[0]!.archivedAt).toBeInstanceOf(Date);
    expect(await findActiveCallbacks(setup.integrationProvider.id)).toEqual([]);

    let fetched = await callbackService.getCallbackById({
      instance: scope.instance,
      callbackId: setup.callback.id
    });
    expect(fetched.status).toBe('archived');
    await expectServiceError(
      callbackService.updateCallback({
        instance: scope.instance,
        auditScope: scope.auditScope,
        callback: fetched,
        input: { name: uniqueId('late-rename') }
      }),
      'callback_not_active'
    );

    let list = async (
      input: Omit<Parameters<typeof callbackService.listCallbacks>[0], 'instance'>
    ) =>
      ids(
        await firstPage(
          await callbackService.listCallbacks({ instance: scope.instance, ...input })
        )
      );
    expect(await list({ integrationProviderIds: [setup.integrationProvider.id] })).toEqual([]);
    expect(
      await list({
        integrationProviderIds: [setup.integrationProvider.id],
        status: ['archived']
      })
    ).toEqual([setup.callback.id]);

    let callbackInstanceId = archived.callbackInstances[0]!.id;
    await expectServiceError(
      callbackInstanceService.getCallbackInstanceById({
        instance: scope.instance,
        callbackInstanceId
      }),
      'not_found'
    );
    expect(
      await callbackInstanceService.getCallbackInstanceById({
        instance: scope.instance,
        callbackInstanceId,
        allowDeleted: true
      })
    ).toMatchObject({ id: callbackInstanceId, status: 'archived' });
  }, 180_000);

  it('hides callbacks and callback instances from other organizations', async () => {
    let { callback, integrationProvider } = await ensureCallback();
    let setup = await ensureInstanceSetup();
    let other = await scopeOf(otherOrg);
    let callbackInstance = await subspaceDb.callbackInstance.findFirst({
      where: { callbackOid: setup.callback.oid }
    });

    await expectServiceError(
      callbackService.getCallbackById({ instance: other.instance, callbackId: callback.id }),
      'not_found'
    );
    expect(
      await firstPage(
        await callbackService.listCallbacks({ instance: other.instance, ids: [callback.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await callbackService.listCallbacks({
          instance: other.instance,
          integrationProviderIds: [integrationProvider.id]
        })
      )
    ).toEqual([]);

    if (callbackInstance) {
      await expectServiceError(
        callbackInstanceService.getCallbackInstanceById({
          instance: other.instance,
          callbackInstanceId: callbackInstance.id,
          allowDeleted: true
        }),
        'not_found'
      );
    }
    expect(
      await firstPage(
        await callbackInstanceService.listCallbackInstances({
          instance: other.instance,
          callbackIds: [setup.callback.id],
          allowDeleted: true
        })
      )
    ).toEqual([]);
  });
});
