import { describe, expect, it } from 'vitest';
import {
  OpCode,
  WireMessage,
  createClientReplica,
  createMemoryDeltaTransport,
  createServerState,
  pipeServerToTransport,
  pipeTransportToClient
} from '../src/lib/delta';

type TestState = {
  doc: {
    text: string;
    tags: string[];
  };
  items: string[];
};

let initialState = (): TestState => ({
  doc: {
    text: 'hello',
    tags: ['a']
  },
  items: ['first']
});

describe('delta server', () => {
  it('emits a single-operation batch for direct mutations', () => {
    let server = createServerState({ initial: initialState() });
    let messages: WireMessage<TestState>[] = [];
    server.onWireMessage(message => messages.push(message));

    server.state.doc.text += ' world';

    expect(server.version).toBe(1);
    expect(messages).toEqual([[1, [OpCode.StringAppend, ['doc', 'text'], ' world']]]);
  });

  it('coalesces mutations inside a transaction', () => {
    let server = createServerState({ initial: initialState() });
    let messages: WireMessage<TestState>[] = [];
    server.onWireMessage(message => messages.push(message));

    server.transact(() => {
      server.state.doc.text += '!';
      server.state.doc.tags.push('new');
      server.state.items[0] = 'updated';
    });

    expect(messages).toEqual([
      [
        1,
        [OpCode.StringAppend, ['doc', 'text'], '!'],
        [OpCode.ArrayInsert, ['doc', 'tags'], 1, ['new']],
        [OpCode.ArraySet, ['items'], 0, 'updated']
      ]
    ]);
  });

  it('does not emit empty transactions', () => {
    let server = createServerState({ initial: initialState() });
    let messages: WireMessage<TestState>[] = [];
    server.onWireMessage(message => messages.push(message));

    server.transact(() => {
      server.state.doc.text = 'hello';
    });

    expect(server.version).toBe(0);
    expect(messages).toEqual([]);
  });

  it('records splice removal and insertion in order', () => {
    let server = createServerState({ initial: initialState() });
    let messages: WireMessage<TestState>[] = [];
    server.onWireMessage(message => messages.push(message));

    server.state.doc.tags.splice(0, 1, 'b', 'c');

    expect(messages).toEqual([
      [
        1,
        [OpCode.ArrayRemove, ['doc', 'tags'], 0, 1],
        [OpCode.ArrayInsert, ['doc', 'tags'], 0, ['b', 'c']]
      ]
    ]);
  });

  it('can emit tagged delta messages', () => {
    let server = createServerState({ initial: initialState(), deltaFormat: 'message' });
    let messages: WireMessage<TestState>[] = [];
    server.onWireMessage(message => messages.push(message));

    server.state.doc.tags.unshift('x');

    expect(messages).toEqual([['d', 1, [OpCode.ArrayInsert, ['doc', 'tags'], 0, ['x']]]]);
  });
});

describe('delta client', () => {
  it('applies a batch and notifies once after all operations', () => {
    let notifications: TestState[] = [];
    let replica = createClientReplica<TestState>({
      initial: initialState(),
      onChange: state => notifications.push(state)
    });

    replica.receive([
      1,
      [OpCode.StringAppend, ['doc', 'text'], ' world'],
      [OpCode.ArrayInsert, ['doc', 'tags'], 1, ['b']]
    ]);

    expect(replica.getIndex()).toBe(1);
    expect(replica.getState()).toEqual({
      doc: { text: 'hello world', tags: ['a', 'b'] },
      items: ['first']
    });
    expect(notifications).toHaveLength(1);
  });

  it('ignores duplicate batches', () => {
    let calls = 0;
    let replica = createClientReplica<TestState>({
      initial: initialState(),
      onChange: () => calls++
    });

    replica.receive([1, [OpCode.StringAppend, ['doc', 'text'], '!']]);
    replica.receive([1, [OpCode.StringAppend, ['doc', 'text'], '!']]);

    expect(replica.getState().doc.text).toBe('hello!');
    expect(calls).toBe(1);
  });

  it('requests a snapshot on an index gap or failed operation', () => {
    let requests: unknown[] = [];
    let replica = createClientReplica<TestState>({
      initial: initialState(),
      onSnapshotRequired: reason => requests.push(reason)
    });

    replica.receive([2, [OpCode.StringAppend, ['doc', 'text'], '!']]);
    replica.receive([1, [OpCode.ArrayInsert, ['doc', 'text'], 0, ['bad']]]);

    expect(replica.getIndex()).toBe(0);
    expect(replica.getState()).toEqual(initialState());
    expect(requests).toHaveLength(2);
  });

  it('resets from snapshots', () => {
    let replica = createClientReplica<TestState>({ initial: initialState() });

    replica.receive(['s', 42, { doc: { text: 'snapshot', tags: [] }, items: [] }]);

    expect(replica.getIndex()).toBe(42);
    expect(replica.getState()).toEqual({ doc: { text: 'snapshot', tags: [] }, items: [] });
  });
});

describe('delta transports', () => {
  it('connects a server and client through the transport interfaces', () => {
    let server = createServerState({ initial: initialState() });
    let client = createClientReplica<TestState>({ initial: initialState() });
    let transport = createMemoryDeltaTransport<WireMessage<TestState>>();

    let unsubscribeServer = pipeServerToTransport(server, transport);
    let unsubscribeClient = pipeTransportToClient(transport, client);

    server.transact(() => {
      server.state.doc.text += '!';
      server.state.doc.tags.push('new');
    });

    expect(client.getIndex()).toBe(1);
    expect(client.getState()).toEqual({
      doc: { text: 'hello!', tags: ['a', 'new'] },
      items: ['first']
    });

    unsubscribeServer();
    unsubscribeClient();
  });
});
