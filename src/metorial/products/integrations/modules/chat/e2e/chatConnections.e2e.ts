import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import {
  integrationProviderService,
  integrationService
} from '@metorial-subspace/module-integration';
import { describe, expect, it } from 'vitest';
import {
  chatConnectionProviderService,
  chatConnectionService,
  chatEventService
} from '../src';
import { flushChatEventPayload } from '../src/queues/event/payloadFlush';
import {
  createStandaloneConnection,
  expectConsistentPaging,
  type Fixture,
  pageThrough,
  providerTestTimeout,
  useChatProviders,
  workerTimeout
} from './_fixtures';

let searchToken = () => uniqueId('srch').replace(/-/g, '');

let connectionEvents = async (fixture: Fixture, chatConnectionId: string) =>
  firstPage(
    await chatEventService.listChatEvents({
      instance: fixture.instance,
      chatConnectionIds: [chatConnectionId]
    })
  );

let waitForConnectionEvent = (fixture: Fixture, chatConnectionId: string, type: string) =>
  eventually(async () => {
    let events = await connectionEvents(fixture, chatConnectionId);
    let event = events.find(item => item.type === type);
    expect(event).toBeDefined();
    return event!;
  }, workerTimeout);

describe('module-chat chat connections', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useChatProviders(org, server);

  it('creates a standalone connection backed by a hidden adapter integration', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Chat connection');

    let chatConnection = await createStandaloneConnection(fixture, {
      name: `  ${name}  `,
      description: '  Described  ',
      metadata: { team: 'e2e' },
      privateMetadata: { secret: true }
    });

    expect(chatConnection).toMatchObject({
      name,
      description: 'Described',
      status: 'active',
      archivedAt: null
    });
    expect(chatConnection.providers).toEqual([]);

    let row = await subspaceDb.chatConnection.findUniqueOrThrow({
      where: { id: chatConnection.id },
      include: {
        adapterIntegration: { include: { integration: true, adapterGlobal: true } }
      }
    });
    expect(row).toMatchObject({
      name,
      description: 'Described',
      metadata: { team: 'e2e' },
      privateMetadata: { secret: true },
      status: 'active'
    });
    expect(row.slug).toMatch(/^[a-z0-9-]+$/);
    expect(row.adapterIntegration).toMatchObject({
      type: 'chat',
      status: 'active',
      isStandalone: true
    });
    expect(row.adapterIntegration.adapterGlobal.identifier).toBe('chat');
    expect(row.adapterIntegration.integration).toMatchObject({
      name,
      status: 'active',
      isAdapterBacking: true
    });

    let fetched = await chatConnectionService.getChatConnectionById({
      instance: fixture.instance,
      chatConnectionId: chatConnection.id
    });
    expect(fetched.id).toBe(chatConnection.id);
  });

  it('records a created lifecycle event and tracks it as a system event', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);

    let event = await waitForConnectionEvent(
      fixture,
      chatConnection.id,
      'chat.connection.created'
    );
    expect(event.source).toBe('internal');

    let { chatEvent, payload } = await chatEventService.getChatEventById({
      instance: fixture.instance,
      chatEventId: event.id
    });
    expect(chatEvent.id).toBe(event.id);
    expect(payload?.chatConnection).toMatchObject({
      id: chatConnection.id,
      name: chatConnection.name
    });

    let systemEvent = await eventually(
      async () => await db.systemEvent.findUniqueOrThrow({ where: { chatEventId: event.id } }),
      workerTimeout
    );
    expect(systemEvent).toMatchObject({
      source: 'chat',
      eventType: 'chat.connection.created',
      chatConnectionId: chatConnection.id,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      providerId: null
    });
  });

  it('requires a name and keeps slugs unique for standalone connections', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await expectServiceError(
      createStandaloneConnection(fixture, { name: '   ' }),
      'adapter_integration_name_required'
    );

    let name = uniqueId('Same name');
    let first = await createStandaloneConnection(fixture, { name });
    let second = await createStandaloneConnection(fixture, { name });

    expect(first.name).toBe(second.name);
    expect(first.slug).not.toBe(second.slug);
  });

  it('updates a connection, clears nullable fields and renames the hidden integration', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture, {
      description: 'Initial',
      metadata: { a: 1 },
      privateMetadata: { b: 2 }
    });
    await waitForConnectionEvent(fixture, chatConnection.id, 'chat.connection.created');

    let renamed = uniqueId('Renamed connection');
    let updated = await chatConnectionService.updateChatConnection({
      instance: fixture.instance,
      chatConnection,
      input: { name: `  ${renamed}  `, description: null, metadata: null }
    });
    expect(updated).toMatchObject({ name: renamed, description: null });

    let row = await subspaceDb.chatConnection.findUniqueOrThrow({
      where: { id: chatConnection.id },
      include: { adapterIntegration: { include: { integration: true } } }
    });
    expect(row).toMatchObject({
      name: renamed,
      description: null,
      metadata: null,
      privateMetadata: { b: 2 }
    });
    expect(row.adapterIntegration.integration.name).toBe(renamed);

    let unchanged = await chatConnectionService.updateChatConnection({
      instance: fixture.instance,
      chatConnection: updated,
      input: {}
    });
    expect(unchanged).toMatchObject({ name: renamed, description: null });

    let event = await waitForConnectionEvent(
      fixture,
      chatConnection.id,
      'chat.connection.updated'
    );
    let { payload } = await chatEventService.getChatEventById({
      instance: fixture.instance,
      chatEventId: event.id
    });
    expect(payload?.chatConnection).toMatchObject({ id: chatConnection.id });
  });

  it('archives a connection, hides it from default lists and rejects further edits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);

    let archived = await chatConnectionService.archiveChatConnection({
      instance: fixture.instance,
      chatConnection
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let row = await subspaceDb.chatConnection.findUniqueOrThrow({
      where: { id: chatConnection.id },
      include: { adapterIntegration: { include: { integration: true } } }
    });
    expect(row.status).toBe('archived');
    expect(row.adapterIntegration.status).toBe('archived');
    expect(row.adapterIntegration.integration.status).toBe('archived');

    let fetched = await chatConnectionService.getChatConnectionById({
      instance: fixture.instance,
      chatConnectionId: chatConnection.id
    });
    expect(fetched.status).toBe('archived');

    let defaultList = await firstPage(
      await chatConnectionService.listChatConnections({
        instance: fixture.instance,
        ids: [chatConnection.id]
      })
    );
    expect(defaultList).toEqual([]);

    let archivedList = await firstPage(
      await chatConnectionService.listChatConnections({
        instance: fixture.instance,
        ids: [chatConnection.id],
        status: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toEqual([chatConnection.id]);

    await expectServiceError(
      chatConnectionService.updateChatConnection({
        instance: fixture.instance,
        chatConnection: archived,
        input: { name: uniqueId('Too late') }
      }),
      'gone'
    );
    await expectServiceError(
      chatConnectionService.archiveChatConnection({
        instance: fixture.instance,
        chatConnection: archived
      }),
      'gone'
    );
    await expectServiceError(
      chatConnectionService.deleteChatConnection({
        instance: fixture.instance,
        chatConnection: archived
      }),
      'gone'
    );
    expect(
      (await subspaceDb.chatConnection.findUniqueOrThrow({ where: { id: chatConnection.id } }))
        .name
    ).toBe(chatConnection.name);

    await waitForConnectionEvent(fixture, chatConnection.id, 'chat.connection.archived');
  });

  it(
    'creates a connection from an existing integration only when it has a chat-capable provider',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let [capable, plain] = await Promise.all([providers.capable(), providers.plain()]);

      let createIntegration = async (providerId: string) => {
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

      let plainIntegration = await createIntegration(plain.providerId);
      await expectServiceError(
        chatConnectionService.createChatConnection({
          instance: fixture.instance,
          mode: 'existing',
          integration: plainIntegration
        }),
        'adapter_integration_no_capable_providers'
      );
      expect(
        await subspaceDb.adapterIntegration.count({
          where: { integrationOid: plainIntegration.oid }
        })
      ).toBe(0);

      let integration = await createIntegration(capable.providerId);
      let chatConnection = await chatConnectionService.createChatConnection({
        instance: fixture.instance,
        mode: 'existing',
        integration
      });
      expect(chatConnection.name).toBe(integration.name);

      let row = await subspaceDb.chatConnection.findUniqueOrThrow({
        where: { id: chatConnection.id },
        include: { adapterIntegration: true }
      });
      expect(row.adapterIntegration).toMatchObject({
        integrationOid: integration.oid,
        isStandalone: false,
        status: 'active'
      });

      let connectionProviders = await firstPage(
        await chatConnectionProviderService.listChatConnectionProviders({
          instance: fixture.instance,
          chatConnectionIds: [chatConnection.id]
        })
      );
      expect(connectionProviders).toHaveLength(1);
      expect(
        connectionProviders[0]!.adapterIntegrationProvider.integrationProvider.provider.id
      ).toBe(capable.providerId);

      await expectServiceError(
        chatConnectionProviderService.createChatConnectionProvider({
          instance: fixture.instance,
          chatConnection,
          input: { providerId: capable.providerId }
        }),
        'adapter_integration_providers_managed_by_integration'
      );

      let again = await chatConnectionService.createChatConnection({
        instance: fixture.instance,
        mode: 'existing',
        integration,
        input: { name: '  Second link  ' }
      });
      expect(again).toMatchObject({ id: chatConnection.id, name: 'Second link' });
      expect(
        await subspaceDb.chatConnection.count({
          where: { adapterIntegrationOid: chatConnection.adapterIntegrationOid }
        })
      ).toBe(1);
      await waitForConnectionEvent(fixture, chatConnection.id, 'chat.connection.updated');
    },
    providerTestTimeout
  );

  it(
    'only attaches providers that implement the chat adapter',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let plain = await providers.plain();
      let chatConnection = await createStandaloneConnection(fixture);

      await expectServiceError(
        chatConnectionProviderService.createChatConnectionProvider({
          instance: fixture.instance,
          chatConnection,
          input: { providerId: plain.providerId }
        }),
        'provider_does_not_implement_adapter'
      );

      let connectionProviders = await firstPage(
        await chatConnectionProviderService.listChatConnectionProviders({
          instance: fixture.instance,
          chatConnectionIds: [chatConnection.id]
        })
      );
      expect(connectionProviders).toEqual([]);
    },
    providerTestTimeout
  );

  it(
    'creates, updates and archives a connection provider',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();
      let chatConnection = await createStandaloneConnection(fixture);

      let chatConnectionProvider =
        await chatConnectionProviderService.createChatConnectionProvider({
          instance: fixture.instance,
          chatConnection,
          input: {
            providerId: capable.providerId,
            name: '  Primary  ',
            description: 'Main provider',
            metadata: { a: 1 }
          }
        });
      expect(chatConnectionProvider).toMatchObject({
        status: 'active',
        name: 'Primary',
        description: 'Main provider',
        metadata: { a: 1 },
        chatConnectionOid: chatConnection.oid
      });
      expect(
        chatConnectionProvider.adapterIntegrationProvider.integrationProvider.provider.id
      ).toBe(capable.providerId);

      let adapterIntegration = await subspaceDb.adapterIntegration.findUniqueOrThrow({
        where: { oid: chatConnection.adapterIntegrationOid }
      });
      let link = await subspaceDb.adapterIntegrationProvider.findUniqueOrThrow({
        where: { oid: chatConnectionProvider.adapterIntegrationProviderOid },
        include: { integrationProvider: true }
      });
      expect(link.status).toBe('active');
      expect(link.integrationProvider.integrationOid).toBe(adapterIntegration.integrationOid);

      let fetchedConnection = await chatConnectionService.getChatConnectionById({
        instance: fixture.instance,
        chatConnectionId: chatConnection.id
      });
      expect(fetchedConnection.providers.map(item => item.id)).toEqual([
        chatConnectionProvider.id
      ]);

      await expectServiceError(
        chatConnectionProviderService.createChatConnectionProvider({
          instance: fixture.instance,
          chatConnection,
          input: { providerId: capable.providerId }
        }),
        'integration_provider_exists'
      );

      let updated = await chatConnectionProviderService.updateChatConnectionProvider({
        instance: fixture.instance,
        chatConnectionProvider,
        input: { name: '  Renamed  ', description: null }
      });
      expect(updated).toMatchObject({ name: 'Renamed', description: null });

      let archived = await chatConnectionProviderService.archiveChatConnectionProvider({
        instance: fixture.instance,
        chatConnectionProvider: updated
      });
      expect(archived.status).toBe('archived');
      expect(
        (
          await subspaceDb.adapterIntegrationProvider.findUniqueOrThrow({
            where: { oid: chatConnectionProvider.adapterIntegrationProviderOid }
          })
        ).status
      ).toBe('archived');

      expect(
        await firstPage(
          await chatConnectionProviderService.listChatConnectionProviders({
            instance: fixture.instance,
            chatConnectionIds: [chatConnection.id]
          })
        )
      ).toEqual([]);
      let archivedList = await firstPage(
        await chatConnectionProviderService.listChatConnectionProviders({
          instance: fixture.instance,
          chatConnectionIds: [chatConnection.id],
          status: ['archived']
        })
      );
      expect(archivedList.map(item => item.id)).toEqual([chatConnectionProvider.id]);

      await expectServiceError(
        chatConnectionProviderService.updateChatConnectionProvider({
          instance: fixture.instance,
          chatConnectionProvider: archived,
          input: { name: 'Too late' }
        }),
        'gone'
      );
      await expectServiceError(
        chatConnectionProviderService.archiveChatConnectionProvider({
          instance: fixture.instance,
          chatConnectionProvider: archived
        }),
        'gone'
      );
    },
    providerTestTimeout
  );

  it(
    'creates a connection together with its first provider',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let capable = await providers.capable();

      let chatConnection = await chatConnectionService.createChatConnectionWithProvider({
        instance: fixture.instance,
        mode: 'standalone',
        input: { name: uniqueId('Chat connection') },
        provider: { providerId: capable.providerId, name: 'Bundled' }
      });

      expect(chatConnection.providers).toHaveLength(1);
      expect(chatConnection.providers[0]).toMatchObject({ name: 'Bundled', status: 'active' });
      expect(
        chatConnection.providers[0]!.adapterIntegrationProvider.integrationProvider.provider.id
      ).toBe(capable.providerId);
    },
    providerTestTimeout
  );

  it.fails(
    'does not leave a connection behind when its first provider is rejected (bug: createChatConnectionWithProvider creates the connection before validating the provider and never rolls it back)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let plain = await providers.plain();
      let name = uniqueId('Orphaned connection');

      await expectServiceError(
        chatConnectionService.createChatConnectionWithProvider({
          instance: fixture.instance,
          mode: 'standalone',
          input: { name },
          provider: { providerId: plain.providerId }
        }),
        'provider_does_not_implement_adapter'
      );

      expect(await subspaceDb.chatConnection.count({ where: { name } })).toBe(0);
    },
    providerTestTimeout
  );

  it('pages through connections without duplicates in both directions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = [];
    for (let index = 0; index < 3; index++) {
      created.push(await createStandaloneConnection(fixture));
    }
    let ids = created.map(item => item.id);

    let paginator = await chatConnectionService.listChatConnections({
      instance: fixture.instance,
      ids
    });
    await expectConsistentPaging(paginator, ids);
  });

  it('finds connections by search once indexed and drops archived ones from the index', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let token = searchToken();
    let chatConnection = await createStandaloneConnection(fixture, {
      name: `Searchable ${token}`
    });

    await eventually(async () => {
      let found = await firstPage(
        await chatConnectionService.listChatConnections({
          instance: fixture.instance,
          search: token
        })
      );
      expect(found.map(item => item.id)).toEqual([chatConnection.id]);
    }, workerTimeout);

    expect(
      await firstPage(
        await chatConnectionService.listChatConnections({
          instance: otherFixture.instance,
          search: token
        })
      )
    ).toEqual([]);

    await chatConnectionService.archiveChatConnection({
      instance: fixture.instance,
      chatConnection
    });

    await eventually(async () => {
      let found = await firstPage(
        await chatConnectionService.listChatConnections({
          instance: fixture.instance,
          search: token,
          status: ['active', 'archived']
        })
      );
      expect(found).toEqual([]);
    }, workerTimeout);
  });

  it('lists lifecycle events newest first with type filters and stable paging', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    await waitForConnectionEvent(fixture, chatConnection.id, 'chat.connection.created');

    let current = chatConnection;
    for (let index = 0; index < 2; index++) {
      current = await chatConnectionService.updateChatConnection({
        instance: fixture.instance,
        chatConnection: current,
        input: { name: uniqueId('Renamed') }
      });
    }

    let events = await eventually(async () => {
      let events = await connectionEvents(fixture, chatConnection.id);
      expect(events).toHaveLength(3);
      return events;
    }, workerTimeout);

    expect(events.map(item => item.type).sort()).toEqual([
      'chat.connection.created',
      'chat.connection.updated',
      'chat.connection.updated'
    ]);
    expect(events.at(-1)!.type).toBe('chat.connection.created');
    let occurredAt = events.map(item => item.occurredAt.getTime());
    expect(occurredAt).toEqual([...occurredAt].sort((a, b) => b - a));

    let paged = await pageThrough(
      await chatEventService.listChatEvents({
        instance: fixture.instance,
        chatConnectionIds: [chatConnection.id]
      })
    );
    expect(paged.map(item => item.id)).toEqual(events.map(item => item.id));

    let updates = await firstPage(
      await chatEventService.listChatEvents({
        instance: fixture.instance,
        chatConnectionIds: [chatConnection.id],
        types: ['chat.connection.updated']
      })
    );
    expect(updates).toHaveLength(2);

    let future = await firstPage(
      await chatEventService.listChatEvents({
        instance: fixture.instance,
        chatConnectionIds: [chatConnection.id],
        occurredAt: { gt: new Date(Date.now() + 60_000) }
      })
    );
    expect(future).toEqual([]);
  });

  it('flushes an inline event payload to storage and still resolves it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    let event = await waitForConnectionEvent(
      fixture,
      chatConnection.id,
      'chat.connection.created'
    );
    let before = await chatEventService.getChatEventById({
      instance: fixture.instance,
      chatEventId: event.id
    });

    expect(await flushChatEventPayload({ chatEventId: event.id })).toBe(true);

    let row = await subspaceDb.chatEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row.payloadStorageKey).toBe(event.id);
    expect(row.payload).toBeNull();

    let after = await chatEventService.getChatEventById({
      instance: fixture.instance,
      chatEventId: event.id
    });
    expect(after.payload).toEqual(before.payload);

    expect(await flushChatEventPayload({ chatEventId: event.id })).toBe(false);
  });

  it('isolates connections, providers and events between organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let chatConnection = await createStandaloneConnection(fixture);
    let event = await waitForConnectionEvent(
      fixture,
      chatConnection.id,
      'chat.connection.created'
    );

    await expectServiceError(
      chatConnectionService.getChatConnectionById({
        instance: otherFixture.instance,
        chatConnectionId: chatConnection.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await chatConnectionService.listChatConnections({
          instance: otherFixture.instance,
          ids: [chatConnection.id]
        })
      )
    ).toEqual([]);

    await expect(
      chatConnectionService.updateChatConnection({
        instance: otherFixture.instance,
        chatConnection,
        input: { name: uniqueId('Hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      chatConnectionService.archiveChatConnection({
        instance: otherFixture.instance,
        chatConnection
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      chatConnectionProviderService.createChatConnectionProvider({
        instance: otherFixture.instance,
        chatConnection,
        input: { providerId: uniqueId('provider') }
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await firstPage(
        await chatEventService.listChatEvents({
          instance: otherFixture.instance,
          chatConnectionIds: [chatConnection.id]
        })
      )
    ).toEqual([]);
    await expectServiceError(
      chatEventService.getChatEventById({
        instance: otherFixture.instance,
        chatEventId: event.id
      }),
      'not_found'
    );

    let row = await subspaceDb.chatConnection.findUniqueOrThrow({
      where: { id: chatConnection.id }
    });
    expect(row).toMatchObject({ name: chatConnection.name, status: 'active' });
  });
});
