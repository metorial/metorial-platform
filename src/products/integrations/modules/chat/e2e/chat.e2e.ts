import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  chatConnectionService,
  chatEventService,
  chatInstanceService,
  chatService
} from '../src';

describe('module-chat', () => {
  let org = useOrganization();

  it('lists no chat connections, instances, chats or events for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await chatConnectionService.listChatConnections({ instance }))
    ).toEqual([]);
    expect(await firstPage(await chatInstanceService.listChatInstances({ instance }))).toEqual(
      []
    );
    expect(await firstPage(await chatService.listChats({ instance }))).toEqual([]);
    expect(await firstPage(await chatEventService.listChatEvents({ instance }))).toEqual([]);

    await expect(
      chatConnectionService.getChatConnectionById({
        instance,
        chatConnectionId: uniqueId('missing-connection')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      chatInstanceService.getChatInstanceById({
        instance,
        chatInstanceId: uniqueId('missing-instance')
      })
    ).rejects.toThrow(/could not be found/);
  });

  it('creates a standalone chat connection once the chat adapter is registered', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('chat-connection');
    let create = () =>
      chatConnectionService.createChatConnection({
        instance,
        mode: 'standalone',
        input: { name, description: 'E2E chat connection' }
      });

    let adapter = await subspaceDb.providerAdapterGlobal.findUnique({
      where: { identifier: 'chat' }
    });
    if (!adapter) {
      await expect(create()).rejects.toThrow(/could not be found/);
      return;
    }

    let chatConnection = await create();
    expect(chatConnection.name).toBe(name);
    expect(chatConnection.status).toBe('active');

    let fetched = await chatConnectionService.getChatConnectionById({
      instance,
      chatConnectionId: chatConnection.id
    });
    expect(fetched.id).toBe(chatConnection.id);

    let connections = await firstPage(
      await chatConnectionService.listChatConnections({ instance })
    );
    expect(connections.map(item => item.id)).toContain(chatConnection.id);
  });
});
