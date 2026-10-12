import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db: {} }));
vi.mock('@metorial/presenters', () => ({}));
vi.mock('./chatMessageAttachment', () => ({ chatMessageAttachmentInternalService: {} }));

import { chatEventPayloadServiceInternal } from './chatEventPayload';

let build = (command: any) =>
  chatEventPayloadServiceInternal.buildChatEventPayload({
    chat: { oid: 1n } as any,
    channel: null,
    thread: null,
    message: null,
    author: null,
    command
  });

describe('chatEventPayloadServiceInternal.buildChatEventPayload', () => {
  it('adds the command invocation without its response token', async () => {
    let payload = await build({
      name: 'ask',
      commandId: '155',
      subcommand: 'now',
      options: [{ name: 'question', type: 'string', value: 'hi' }],
      triggerId: '156',
      responseToken: 'token_1',
      author: { userId: 'U1' },
      channelId: 'C1'
    });

    expect(payload).toEqual({
      command: {
        object: 'chat.command_invocation',
        name: 'ask',
        command_id: '155',
        text: null,
        subcommand: 'now',
        subcommand_group: null,
        options: [{ name: 'question', type: 'string', value: 'hi' }],
        trigger_id: '156'
      }
    });
  });

  it('defaults absent command fields', async () => {
    let payload = await build({ name: 'deploy', author: { userId: 'U1' }, channelId: 'C1' });

    expect(payload.command).toMatchObject({
      text: null,
      options: [],
      trigger_id: null
    });
  });

  it('leaves the command out for other events', async () => {
    await expect(build(null)).resolves.toEqual({});
  });
});
