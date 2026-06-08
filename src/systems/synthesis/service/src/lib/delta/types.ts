export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type Path = (string | number)[];

export enum OpCode {
  Set = 0,
  Delete = 1,
  ArrayInsert = 2,
  ArrayRemove = 3,
  ArraySet = 4,
  StringAppend = 5
}

export type WireOperation =
  | [OpCode.Set, path: Path, value: JsonValue]
  | [OpCode.Delete, path: Path]
  | [OpCode.ArrayInsert, path: Path, at: number, values: JsonValue[]]
  | [OpCode.ArrayRemove, path: Path, at: number, count: number]
  | [OpCode.ArraySet, path: Path, at: number, value: JsonValue]
  | [OpCode.StringAppend, path: Path, suffix: string];

export type WireBatch = [batchIndex: number, ...operations: WireOperation[]];
export type WireSnapshot<T extends JsonValue = JsonValue> = ['s', index: number, state: T];
export type WireDelta = ['d', batchIndex: number, ...operations: WireOperation[]];
export type WireMessage<T extends JsonValue = JsonValue> = WireSnapshot<T> | WireDelta | WireBatch;

export type DeltaTransport<TMessage> = {
  send: (message: TMessage) => void | Promise<void>;
  subscribe: (listener: (message: TMessage) => void) => () => void;
};

export type DeltaTransportSink<TMessage> = Pick<DeltaTransport<TMessage>, 'send'>;
export type DeltaTransportSource<TMessage> = Pick<DeltaTransport<TMessage>, 'subscribe'>;

export type CreateServerStateOptions<T extends JsonValue> = {
  initial: T;
  emit?: DeltaTransportSink<WireMessage<T>>;
  deltaFormat?: 'batch' | 'message';
};

export type ServerStateHandle<T extends JsonValue> = {
  state: T;
  version: number;
  getSnapshot: () => WireSnapshot<T>;
  onWireMessage: (listener: (msg: WireMessage<T>) => void) => () => void;
  transact: (fn: () => void) => void;
};

export type ClientChangeMeta = {
  index: number;
};

export type CreateClientReplicaOptions<T extends JsonValue> = {
  initial?: T;
  index?: number;
  onChange?: (state: T, meta: ClientChangeMeta) => void;
  onSnapshotRequired?: (
    reason: unknown,
    meta: { expectedIndex: number; receivedIndex?: number }
  ) => void;
};

export type ClientReplica<T extends JsonValue> = {
  getState: () => T;
  getIndex: () => number;
  subscribe: (listener: (state: T, meta: ClientChangeMeta) => void) => () => void;
  receive: (msg: WireMessage<T>) => void;
  reset: (snapshot: T, index: number) => void;
};
