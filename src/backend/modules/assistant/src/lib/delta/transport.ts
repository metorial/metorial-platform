import {
  ClientReplica,
  DeltaTransportSink,
  DeltaTransportSource,
  JsonValue,
  ServerStateHandle,
  WireMessage
} from './types';

export let pipeServerToTransport = <T extends JsonValue>(
  server: ServerStateHandle<T>,
  transport: DeltaTransportSink<WireMessage<T>>
) => server.onWireMessage(message => void transport.send(message));

export let pipeTransportToClient = <T extends JsonValue>(
  transport: DeltaTransportSource<WireMessage<T>>,
  client: ClientReplica<T>
) => transport.subscribe(message => client.receive(message));

export let createMemoryDeltaTransport = <TMessage>() => {
  let listeners = new Set<(message: TMessage) => void>();

  return {
    send: (message: TMessage) => {
      for (let listener of listeners) listener(message);
    },
    subscribe: (listener: (message: TMessage) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};
