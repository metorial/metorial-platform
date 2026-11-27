import {
  createRemoteProvider,
  expectServiceError,
  firstPage,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { getId, type WebhookRegistration } from '@metorial-subspace/db';
import { describe, expect, it } from 'vitest';
import { webhookRegistrationService } from '../src';
import { enableProviderTriggers, scopeOf } from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-callback webhook registrations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useFixture(async () => {
    let [plain, unsupported, supported] = await Promise.all([
      createRemoteProvider(org.clients.instance, { url: server.url }),
      createRemoteProvider(org.clients.instance, { url: server.url }),
      createRemoteProvider(org.clients.instance, { url: server.url })
    ]);
    await enableProviderTriggers(unsupported.providerId, 'unsupported');
    await enableProviderTriggers(supported.providerId, 'supported');

    return {
      plain: plain.providerId,
      unsupported: unsupported.providerId,
      supported: supported.providerId
    };
  });

  let create = async (providerId: string, name = uniqueId('registration')) => {
    let scope = await scopeOf(org);
    return webhookRegistrationService.createWebhookRegistration({
      instance: scope.instance,
      auditScope: scope.auditScope,
      provider: { id: providerId },
      input: { name, description: 'Receives issue events', metadata: { source: 'e2e' } }
    });
  };

  let deletedOnce: Promise<WebhookRegistration> | undefined;
  let ensureDeletedRegistration = () =>
    (deletedOnce ??= (async () => {
      let name = uniqueId('registration');
      await expectServiceError(
        create(providers.supported, name),
        'webhook_registration_not_supported'
      );

      return await subspaceDb.webhookRegistration.findFirstOrThrow({
        where: { name, provider: { id: providers.supported } }
      });
    })());

  let awaitingSetup = async () => {
    let template = await ensureDeletedRegistration();

    return await subspaceDb.webhookRegistration.create({
      data: {
        ...getId('webhookRegistration'),
        status: 'awaiting_setup',
        name: uniqueId('registration'),
        description: 'Receives issue events',
        metadata: { source: 'e2e' },
        providerOid: template.providerOid,
        providerVariantOid: template.providerVariantOid,
        tenantOid: template.tenantOid,
        projectOid: template.projectOid,
        environmentOid: template.environmentOid,
        instanceOid: template.instanceOid,
        solutionOid: template.solutionOid
      }
    });
  };

  it('rejects providers that cannot receive webhook registrations', async () => {
    await expectServiceError(create(providers.plain), 'webhook_registration_not_supported');
    await expectServiceError(
      create(providers.unsupported),
      'webhook_registration_not_supported'
    );

    expect(
      await subspaceDb.webhookRegistration.count({
        where: { provider: { id: { in: [providers.plain, providers.unsupported] } } }
      })
    ).toBe(0);
  });

  it('leaves a deleted registration behind when the provider backend cannot register webhooks', async () => {
    let scope = await scopeOf(org);
    let deleted = await ensureDeletedRegistration();

    expect(deleted).toMatchObject({
      status: 'deleted',
      description: 'Receives issue events',
      metadata: { source: 'e2e' },
      receiveUrl: null,
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid
    });

    await expectServiceError(
      webhookRegistrationService.getWebhookRegistrationById({
        instance: scope.instance,
        webhookRegistrationId: deleted.id
      }),
      'not_found'
    );
    expect(
      await webhookRegistrationService.getWebhookRegistrationById({
        instance: scope.instance,
        webhookRegistrationId: deleted.id,
        allowDeleted: true
      })
    ).toMatchObject({ id: deleted.id, status: 'deleted' });

    let list = async (input: { allowDeleted?: boolean; status?: 'deleted'[] }) =>
      ids(
        await firstPage(
          await webhookRegistrationService.listWebhookRegistrations({
            instance: scope.instance,
            providerIds: [providers.supported],
            ...input
          })
        )
      );
    expect(await list({})).not.toContain(deleted.id);
    expect(await list({ allowDeleted: true, status: ['deleted'] })).toContain(deleted.id);
  });

  it('hides a deleted registration when only the deleted status is requested without allowDeleted', async () => {
    let scope = await scopeOf(org);
    let deleted = await ensureDeletedRegistration();

    expect(
      ids(
        await firstPage(
          await webhookRegistrationService.listWebhookRegistrations({
            instance: scope.instance,
            providerIds: [providers.supported],
            status: ['deleted']
          })
        )
      )
    ).not.toContain(deleted.id);
  });

  it('lists a deleted registration with allowDeleted alone', async () => {
    let scope = await scopeOf(org);
    let deleted = await ensureDeletedRegistration();

    expect(
      ids(
        await firstPage(
          await webhookRegistrationService.listWebhookRegistrations({
            instance: scope.instance,
            providerIds: [providers.supported],
            allowDeleted: true
          })
        )
      )
    ).toContain(deleted.id);
  });

  it('serves, refuses backend changes to, and archives a registration awaiting setup', async () => {
    let scope = await scopeOf(org);
    let registration = await awaitingSetup();
    let byScope = { instance: scope.instance, auditScope: scope.auditScope };

    let fetched = await webhookRegistrationService.getWebhookRegistrationById({
      instance: scope.instance,
      webhookRegistrationId: registration.id
    });
    expect(fetched).toMatchObject({
      id: registration.id,
      status: 'awaiting_setup',
      provider: expect.objectContaining({ id: providers.supported })
    });

    let list = async (
      input: Omit<
        Parameters<typeof webhookRegistrationService.listWebhookRegistrations>[0],
        'instance'
      >
    ) =>
      ids(
        await firstPage(
          await webhookRegistrationService.listWebhookRegistrations({
            instance: scope.instance,
            ...input
          })
        )
      );
    expect(await list({ ids: [registration.id] })).toEqual([registration.id]);
    expect(await list({ providerIds: [providers.supported] })).toContain(registration.id);
    expect(await list({ providerIds: [providers.unsupported] })).toEqual([]);
    expect(await list({ ids: [registration.id], status: ['awaiting_setup'] })).toEqual([
      registration.id
    ]);
    expect(await list({ ids: [registration.id], status: ['active'] })).toEqual([]);

    await expectServiceError(
      webhookRegistrationService.finishWebhookRegistrationSetup({
        ...byScope,
        webhookRegistration: fetched,
        input: { userConfig: { secret: 'whsec_e2e' } }
      }),
      'webhook_registration_not_supported'
    );
    await expectServiceError(
      webhookRegistrationService.updateWebhookRegistration({
        ...byScope,
        webhookRegistration: fetched,
        input: { name: uniqueId('renamed') }
      }),
      'webhook_registration_not_supported'
    );
    expect(
      await subspaceDb.webhookRegistration.findUniqueOrThrow({
        where: { id: registration.id }
      })
    ).toMatchObject({ status: 'awaiting_setup', name: registration.name });

    let archived = await webhookRegistrationService.archiveWebhookRegistration({
      ...byScope,
      webhookRegistration: fetched
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let again = await webhookRegistrationService.archiveWebhookRegistration({
      ...byScope,
      webhookRegistration: archived
    });
    expect(again.archivedAt).toEqual(archived.archivedAt);

    await expectServiceError(
      webhookRegistrationService.updateWebhookRegistration({
        ...byScope,
        webhookRegistration: archived,
        input: { name: uniqueId('renamed') }
      }),
      'webhook_registration_archived'
    );
    await expectServiceError(
      webhookRegistrationService.finishWebhookRegistrationSetup({
        ...byScope,
        webhookRegistration: archived,
        input: { userConfig: {} }
      }),
      'webhook_registration_not_awaiting_setup'
    );

    expect(
      await webhookRegistrationService.getWebhookRegistrationById({
        instance: scope.instance,
        webhookRegistrationId: registration.id
      })
    ).toMatchObject({ status: 'archived' });
    expect(await list({ ids: [registration.id] })).toEqual([]);
    expect(await list({ ids: [registration.id], status: ['archived'] })).toEqual([
      registration.id
    ]);
  });

  it('hides registrations and private providers from other organizations', async () => {
    let registration = await awaitingSetup();
    let other = await scopeOf(otherOrg);

    await expectServiceError(
      webhookRegistrationService.getWebhookRegistrationById({
        instance: other.instance,
        webhookRegistrationId: registration.id,
        allowDeleted: true
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await webhookRegistrationService.listWebhookRegistrations({
          instance: other.instance,
          ids: [registration.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await webhookRegistrationService.listWebhookRegistrations({
          instance: other.instance,
          providerIds: [providers.supported]
        })
      )
    ).toEqual([]);

    await expectServiceError(
      webhookRegistrationService.createWebhookRegistration({
        instance: other.instance,
        auditScope: other.auditScope,
        provider: { id: providers.supported },
        input: { name: uniqueId('registration') }
      }),
      'not_found'
    );
  });
});
