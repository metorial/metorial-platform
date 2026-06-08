import { applyBatch } from './apply';
import type {
  ClientChangeMeta,
  ClientReplica,
  CreateClientReplicaOptions,
  JsonValue,
  WireMessage
} from './types';
import { cloneJson, normalizeBatch } from './util';

class Replica<T extends JsonValue> implements ClientReplica<T> {
  private state: T;
  private index: number;
  private listeners = new Set<(state: T, meta: ClientChangeMeta) => void>();

  constructor(private readonly options: CreateClientReplicaOptions<T> = {}) {
    this.state = cloneJson((options.initial ?? null) as T);
    this.index = options.index ?? 0;

    if (options.onChange) this.listeners.add(options.onChange);
  }

  getState = () => this.state;

  getIndex = () => this.index;

  subscribe = (listener: (state: T, meta: ClientChangeMeta) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  receive = (message: WireMessage<T>) => {
    if (message[0] == 's') {
      this.reset(message[2], message[1]);
      return;
    }

    let batch = normalizeBatch(message);
    if (!batch) return;

    let receivedIndex = batch[0];
    let expectedIndex = this.index + 1;

    if (receivedIndex <= this.index) return;
    if (receivedIndex != expectedIndex) {
      this.requestSnapshot(new Error(`Expected batch index ${expectedIndex}, got ${receivedIndex}`), {
        expectedIndex,
        receivedIndex
      });
      return;
    }

    try {
      let next = applyBatch(this.state, batch);
      this.state = next;
      this.index = receivedIndex;
      this.notify();
    } catch (error) {
      this.requestSnapshot(error, { expectedIndex, receivedIndex });
    }
  };

  reset = (snapshot: T, index: number) => {
    this.state = cloneJson(snapshot);
    this.index = index;
    this.notify();
  };

  private notify() {
    let meta = { index: this.index };
    for (let listener of this.listeners) listener(this.state, meta);
  }

  private requestSnapshot(
    reason: unknown,
    meta: { expectedIndex: number; receivedIndex?: number }
  ) {
    this.options.onSnapshotRequired?.(reason, meta);
  }
}

export let createClientReplica = <T extends JsonValue>(
  options: CreateClientReplicaOptions<T> = {}
): ClientReplica<T> => new Replica(options);
