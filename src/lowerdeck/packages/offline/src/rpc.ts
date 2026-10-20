import { createOfflineRecord, recordStubbedCall } from './stub';

let offlineResponderKey = Symbol.for('lowerdeck.offline.rpc');

export let installRpcStub = () => {
  (globalThis as any)[offlineResponderKey] ??= async (call: { name: string }) => {
    recordStubbedCall('rpc');
    return { data: createOfflineRecord(`rpc.${call.name}`), status: 200, headers: {} };
  };
};
