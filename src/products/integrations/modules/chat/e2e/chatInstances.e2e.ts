import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import {
  integrationInstanceService,
  integrationProviderService,
  integrationService
} from '@metorial-subspace/module-integration';
import { describe, expect, it } from 'vitest';
import {
  chatConnectionService,
  chatEventService,
  chatInstanceProviderService,
  chatInstanceService,
  chatService,
  chatWorkspaceService
} from '../src';
import {
  createChatSetup,
  createStandaloneConnection,
  expectConsistentPaging,
  type Fixture,
  providerTestTimeout,
  useChatProviders,
  workerTimeout
} from './_fixtures';

let waitForInstanceEvent = (fixture: Fixture, chatInstanceId: string, type: string) =>
  eventually(async () => {
    let events = await firstPage(
      await chatEventService.listChatEvents({
        instance: fixture.instance,
        chatInstanceIds: [chatInstanceId]
      })
    );
    let event = events.find(item => item.type === type);
    expect(event).toBeDefined();
    return event!;
  }, workerTimeout);

describe('module-chat chat instances', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useChatProviders(org, server);

  let createStandaloneInstance = async (
    fixture: Fixture,
    name = uniqueId('Chat instance')
  ) => {
    let chatConnection = await createStandaloneConnection(fixture);
    let chatInstance = await chatInstanceService.createChatInstance({
      instance: fixture.instance,
      chatConnection,
      createStandaloneInstance: { name }
    });
    return { chatConnection, chatInstance };
  };

  let createIntegrationWithProvider = async (fixture: Fixture, providerId: string) => {
    let integration = await integrationService.createIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Integration') }
    });
    await integrationProviderService.createIntegrationProvider({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration,
      input: { providerId }
    });
    return integration;
  };

  it('creates a draft standalone instance backed by a hidden integration instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    let name = uniqueId('Chat instance');

    let chatInstance = await chatInstanceService.createChatInstance({
      instance: fixture.instance,
      chatConnection,
      createStandaloneInstance: { name },
      input: { description: '  Described  ', metadata: { a: 1 }, privateMetadata: { b: 2 } }
    });

    expect(chatInstance).toMatchObject({
      name,
      description: 'Described',
      metadata: { a: 1 },
      privateMetadata: { b: 2 },
      status: 'draft',
      isParentDeleted: false,
      chatConnectionOid: chatConnection.oid
    });
    expect(chatInstance.providers).toEqual([]);

    let row = await subspaceDb.chatInstance.findUniqueOrThrow({
      where: { id: chatInstance.id },
      include: {
        adapterIntegrationInstance: { include: { integrationInstance: true } }
      }
    });
    expect(row.adapterIntegrationInstance).toMatchObject({
      adapterIntegrationOid: chatConnection.adapterIntegrationOid,
      status: 'draft'
    });
    expect(row.adapterIntegrationInstance.integrationInstance).toMatchObject({
      name,
      status: 'draft'
    });

    let listed = await firstPage(
      await chatInstanceService.listChatInstances({
        instance: fixture.instance,
        chatConnectionIds: [chatConnection.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([chatInstance.id]);

    let event = await waitForInstanceEvent(fixture, chatInstance.id, 'chat.instance.created');
    let { payload } = await chatEventService.getChatEventById({
      instance: fixture.instance,
      chatEventId: event.id
    });
    expect(payload?.chatInstance).toMatchObject({ id: chatInstance.id });
  });

  it('rejects linking a visible integration instance to a standalone connection', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    let integration = await integrationService.createIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Integration') }
    });
    let integrationInstance = await integrationInstanceService.createIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration,
      input: { name: uniqueId('Instance') }
    });

    await expectServiceError(
      chatInstanceService.createChatInstance({
        instance: fixture.instance,
        chatConnection,
        integrationInstance
      }),
      'adapter_instance_link_blocked_for_standalone'
    );
    expect(
      await firstPage(
        await chatInstanceService.listChatInstances({
          instance: fixture.instance,
          chatConnectionIds: [chatConnection.id]
        })
      )
    ).toEqual([]);
  });

  it(
    'links instances of the backing integration for existing-mode connections',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let integration = await createIntegrationWithProvider(fixture, capable.providerId);
      let otherIntegration = await createIntegrationWithProvider(fixture, capable.providerId);

      let chatConnection = await chatConnectionService.createChatConnection({
        instance: fixture.instance,
        mode: 'existing',
        integration
      });

      await expectServiceError(
        chatInstanceService.createChatInstance({
          instance: fixture.instance,
          chatConnection
        }),
        'adapter_instance_source_required'
      );

      let foreignInstance = await integrationInstanceService.createIntegrationInstance({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integration: otherIntegration,
        input: { name: uniqueId('Foreign instance') }
      });
      await expectServiceError(
        chatInstanceService.createChatInstance({
          instance: fixture.instance,
          chatConnection,
          integrationInstance: foreignInstance
        }),
        'adapter_instance_integration_mismatch'
      );

      let integrationInstance = await integrationInstanceService.createIntegrationInstance({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integration,
        input: {
          name: uniqueId('Linked instance'),
          providers: [{ providerId: capable.providerId }]
        }
      });

      let chatInstance = await chatInstanceService.createChatInstance({
        instance: fixture.instance,
        chatConnection,
        integrationInstance
      });
      expect(chatInstance).toMatchObject({
        name: integrationInstance.name,
        status: 'active'
      });

      let relinked = await chatInstanceService.createChatInstance({
        instance: fixture.instance,
        chatConnection,
        integrationInstance,
        input: { name: 'Relinked' }
      });
      expect(relinked.id).toBe(chatInstance.id);
      expect(relinked.name).toBe('Relinked');
      await waitForInstanceEvent(fixture, chatInstance.id, 'chat.instance.updated');

      await eventually(async () => {
        let instanceProviders = await firstPage(
          await chatInstanceProviderService.listChatInstanceProviders({
            instance: fixture.instance,
            chatInstanceIds: [chatInstance.id]
          })
        );
        expect(instanceProviders).toHaveLength(1);
        expect(
          instanceProviders[0]!.adapterIntegrationInstanceProvider.integrationProvider.provider
            .id
        ).toBe(capable.providerId);
      }, workerTimeout);
    },
    providerTestTimeout
  );

  it('updates an instance and mirrors the name onto the hidden integration instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { chatInstance } = await createStandaloneInstance(fixture);
    let renamed = uniqueId('Renamed instance');

    let updated = await chatInstanceService.updateChatInstance({
      instance: fixture.instance,
      chatInstance,
      input: { name: `  ${renamed}  `, description: null, metadata: { c: 3 } }
    });
    expect(updated).toMatchObject({ name: renamed, description: null, metadata: { c: 3 } });

    let row = await subspaceDb.chatInstance.findUniqueOrThrow({
      where: { id: chatInstance.id },
      include: {
        adapterIntegrationInstance: { include: { integrationInstance: true } }
      }
    });
    expect(row.name).toBe(renamed);
    expect(row.adapterIntegrationInstance.integrationInstance.name).toBe(renamed);

    await waitForInstanceEvent(fixture, chatInstance.id, 'chat.instance.updated');
  });

  it(
    'attaches chat-capable providers to an instance and activates it',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let [capable, plain] = await Promise.all([providers.capable(), providers.plain()]);
      let chatConnection = await chatConnectionService.createChatConnectionWithProvider({
        instance: fixture.instance,
        mode: 'standalone',
        input: { name: uniqueId('Chat connection') },
        provider: { providerId: capable.providerId }
      });
      let chatInstance = await chatInstanceService.createChatInstance({
        instance: fixture.instance,
        chatConnection,
        createStandaloneInstance: { name: uniqueId('Chat instance') }
      });

      await expectServiceError(
        chatInstanceProviderService.setChatInstanceProvider({
          instance: fixture.instance,
          chatInstance,
          input: { providerId: plain.providerId }
        }),
        'provider_does_not_implement_adapter'
      );
      await expectServiceError(
        chatInstanceProviderService.setChatInstanceProvider({
          instance: fixture.instance,
          chatInstance,
          input: { providerId: uniqueId('missing-provider') }
        }),
        'provider_not_found'
      );

      let [chatInstanceProvider, ...rest] =
        await chatInstanceProviderService.setChatInstanceProvider({
          instance: fixture.instance,
          chatInstance,
          input: { providerId: capable.providerId }
        });
      expect(rest).toEqual([]);
      expect(chatInstanceProvider).toMatchObject({
        status: 'active',
        chatInstanceOid: chatInstance.oid,
        chatConnectionProviderOid: chatConnection.providers[0]!.oid
      });
      expect(
        chatInstanceProvider!.adapterIntegrationInstanceProvider.integrationProvider.provider
          .id
      ).toBe(capable.providerId);

      let fetched = await chatInstanceProviderService.getChatInstanceProviderById({
        instance: fixture.instance,
        chatInstanceProviderId: chatInstanceProvider!.id
      });
      expect(fetched.id).toBe(chatInstanceProvider!.id);

      await eventually(async () => {
        let current = await chatInstanceService.getChatInstanceById({
          instance: fixture.instance,
          chatInstanceId: chatInstance.id
        });
        expect(current.status).toBe('active');
        expect(current.providers.map(item => item.id)).toEqual([chatInstanceProvider!.id]);
      }, workerTimeout);

      let { providers: syncing } = await chatService.syncChats({
        instance: fixture.instance,
        chatInstance
      });
      expect(syncing.map(item => item.id)).toEqual([chatInstanceProvider!.id]);
    },
    providerTestTimeout
  );

  it(
    'projects the providers passed when creating a standalone instance',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let chatConnection = await chatConnectionService.createChatConnectionWithProvider({
        instance: fixture.instance,
        mode: 'standalone',
        input: { name: uniqueId('Chat connection') },
        provider: { providerId: capable.providerId }
      });

      let chatInstance = await chatInstanceService.createChatInstance({
        instance: fixture.instance,
        chatConnection,
        createStandaloneInstance: {
          name: uniqueId('Chat instance'),
          providers: [{ providerId: capable.providerId }]
        }
      });
      expect(chatInstance.status).toBe('active');

      let instanceProviders = await firstPage(
        await chatInstanceProviderService.listChatInstanceProviders({
          instance: fixture.instance,
          chatInstanceIds: [chatInstance.id]
        })
      );
      expect(instanceProviders).toHaveLength(1);
      expect(instanceProviders[0]).toMatchObject({
        status: 'active',
        chatConnectionProviderOid: chatConnection.providers[0]!.oid
      });
    },
    providerTestTimeout
  );

  it(
    'requires the provider to be attached to the connection first',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let { chatInstance } = await createStandaloneInstance(fixture);

      await expectServiceError(
        chatInstanceProviderService.setChatInstanceProvider({
          instance: fixture.instance,
          chatInstance,
          input: { providerId: capable.providerId }
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await chatInstanceProviderService.listChatInstanceProviders({
            instance: fixture.instance,
            chatInstanceIds: [chatInstance.id]
          })
        )
      ).toEqual([]);
    },
    providerTestTimeout
  );

  it(
    'archives an instance together with its providers and rejects further changes',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let { chatConnection, chatInstance, chatInstanceProvider } = await createChatSetup(
        fixture,
        capable.providerId
      );

      let archived = await chatInstanceService.archiveChatInstance({
        instance: fixture.instance,
        chatInstance
      });
      expect(archived).toMatchObject({ status: 'archived', isParentDeleted: false });
      expect(archived.archivedAt).toBeInstanceOf(Date);

      let providerRow = await subspaceDb.chatInstanceProvider.findUniqueOrThrow({
        where: { id: chatInstanceProvider.id }
      });
      expect(providerRow).toMatchObject({ status: 'archived', isParentDeleted: true });

      let instanceRow = await subspaceDb.chatInstance.findUniqueOrThrow({
        where: { id: chatInstance.id },
        include: {
          adapterIntegrationInstance: { include: { integrationInstance: true } }
        }
      });
      expect(instanceRow.adapterIntegrationInstance.status).toBe('archived');
      expect(instanceRow.adapterIntegrationInstance.integrationInstance.status).toBe(
        'archived'
      );

      let fetched = await chatInstanceService.getChatInstanceById({
        instance: fixture.instance,
        chatInstanceId: chatInstance.id
      });
      expect(fetched.status).toBe('archived');

      expect(
        await firstPage(
          await chatInstanceService.listChatInstances({
            instance: fixture.instance,
            chatConnectionIds: [chatConnection.id]
          })
        )
      ).toEqual([]);
      let archivedList = await firstPage(
        await chatInstanceService.listChatInstances({
          instance: fixture.instance,
          chatConnectionIds: [chatConnection.id],
          status: ['archived']
        })
      );
      expect(archivedList.map(item => item.id)).toEqual([chatInstance.id]);

      await expectServiceError(
        chatInstanceProviderService.getChatInstanceProviderById({
          instance: fixture.instance,
          chatInstanceProviderId: chatInstanceProvider.id
        }),
        'not_found'
      );
      let deletedProvider = await chatInstanceProviderService.getChatInstanceProviderById({
        instance: fixture.instance,
        chatInstanceProviderId: chatInstanceProvider.id,
        allowDeleted: true
      });
      expect(deletedProvider.status).toBe('archived');

      await expectServiceError(
        chatWorkspaceService.listChatWorkspaces({
          instance: fixture.instance,
          chatInstanceProvider: providerRow
        }),
        'chat_integration_instance_provider_archived'
      );
      await expectServiceError(
        chatInstanceService.updateChatInstance({
          instance: fixture.instance,
          chatInstance: archived,
          input: { name: uniqueId('Too late') }
        }),
        'gone'
      );
      await expectServiceError(
        chatInstanceService.archiveChatInstance({
          instance: fixture.instance,
          chatInstance: archived
        }),
        'gone'
      );
      await expectServiceError(
        chatInstanceProviderService.setChatInstanceProvider({
          instance: fixture.instance,
          chatInstance: archived,
          input: { providerId: capable.providerId }
        }),
        'adapter_instance_archived'
      );

      await waitForInstanceEvent(fixture, chatInstance.id, 'chat.instance.archived');
    },
    providerTestTimeout
  );

  it(
    'cascades a connection archive to its providers, instances and instance providers',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let { chatConnection, chatInstance, chatInstanceProvider } = await createChatSetup(
        fixture,
        capable.providerId
      );

      await chatConnectionService.archiveChatConnection({
        instance: fixture.instance,
        chatConnection
      });

      expect(
        await subspaceDb.chatConnectionProvider.findMany({
          where: { chatConnectionOid: chatConnection.oid },
          select: { status: true }
        })
      ).toEqual([{ status: 'archived' }]);
      expect(
        await subspaceDb.chatInstance.findUniqueOrThrow({
          where: { id: chatInstance.id },
          select: { status: true, isParentDeleted: true }
        })
      ).toEqual({ status: 'archived', isParentDeleted: true });
      expect(
        await subspaceDb.chatInstanceProvider.findUniqueOrThrow({
          where: { id: chatInstanceProvider.id },
          select: { status: true, isParentDeleted: true }
        })
      ).toEqual({ status: 'archived', isParentDeleted: true });

      await expectServiceError(
        chatInstanceService.getChatInstanceById({
          instance: fixture.instance,
          chatInstanceId: chatInstance.id
        }),
        'not_found'
      );
      let deleted = await chatInstanceService.getChatInstanceById({
        instance: fixture.instance,
        chatInstanceId: chatInstance.id,
        allowDeleted: true
      });
      expect(deleted.status).toBe('archived');

      expect(
        await firstPage(
          await chatInstanceService.listChatInstances({
            instance: fixture.instance,
            chatConnectionIds: [chatConnection.id],
            status: ['archived']
          })
        )
      ).toEqual([]);

      let archivedConnection = await chatConnectionService.getChatConnectionById({
        instance: fixture.instance,
        chatConnectionId: chatConnection.id
      });
      await expectServiceError(
        chatInstanceService.createChatInstance({
          instance: fixture.instance,
          chatConnection: archivedConnection,
          createStandaloneInstance: { name: uniqueId('Too late') }
        }),
        'gone'
      );
    },
    providerTestTimeout
  );

  it('pages through instances of a connection in both directions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    let created = [];
    for (let index = 0; index < 3; index++) {
      created.push(
        await chatInstanceService.createChatInstance({
          instance: fixture.instance,
          chatConnection,
          createStandaloneInstance: { name: uniqueId('Chat instance') }
        })
      );
    }
    let paginator = await chatInstanceService.listChatInstances({
      instance: fixture.instance,
      chatConnectionIds: [chatConnection.id]
    });
    await expectConsistentPaging(
      paginator,
      created.map(item => item.id)
    );
  });

  it(
    'isolates instances and instance providers between organizations',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let otherFixture = await loadOrganizationFixture(otherOrg.ids);
      let capable = await providers.capable();
      let { chatConnection, chatInstance, chatInstanceProvider } = await createChatSetup(
        fixture,
        capable.providerId
      );

      await expectServiceError(
        chatInstanceService.getChatInstanceById({
          instance: otherFixture.instance,
          chatInstanceId: chatInstance.id
        }),
        'not_found'
      );
      await expectServiceError(
        chatInstanceProviderService.getChatInstanceProviderById({
          instance: otherFixture.instance,
          chatInstanceProviderId: chatInstanceProvider.id
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await chatInstanceService.listChatInstances({
            instance: otherFixture.instance,
            chatConnectionIds: [chatConnection.id]
          })
        )
      ).toEqual([]);
      expect(
        await firstPage(
          await chatInstanceProviderService.listChatInstanceProviders({
            instance: otherFixture.instance,
            chatInstanceIds: [chatInstance.id]
          })
        )
      ).toEqual([]);

      await expect(
        chatInstanceService.createChatInstance({
          instance: otherFixture.instance,
          chatConnection,
          createStandaloneInstance: { name: uniqueId('Hijacked') }
        })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatInstanceService.updateChatInstance({
          instance: otherFixture.instance,
          chatInstance,
          input: { name: uniqueId('Hijacked') }
        })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatInstanceService.archiveChatInstance({
          instance: otherFixture.instance,
          chatInstance
        })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatInstanceProviderService.setChatInstanceProvider({
          instance: otherFixture.instance,
          chatInstance,
          input: { providerId: capable.providerId }
        })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatService.syncChats({ instance: otherFixture.instance, chatInstance })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatWorkspaceService.listChatWorkspaces({
          instance: otherFixture.instance,
          chatInstanceProvider
        })
      ).rejects.toThrow('Tenant mismatch');

      let row = await subspaceDb.chatInstance.findUniqueOrThrow({
        where: { id: chatInstance.id }
      });
      expect(row).toMatchObject({ name: chatInstance.name });
      expect(row.status).not.toBe('archived');
    },
    providerTestTimeout
  );
});
