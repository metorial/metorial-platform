import { projectedTokenHeaders, type ClientOpts } from '@lowerdeck/rpc-client';
import { createNetworkLogsClient as createGeneratedClient } from './generated';

export * from './generated';

export type NetworkLogsClientOpts = ClientOpts & {
  tokenFile?: string;
};

export let createNetworkLogsClient = ({ tokenFile, ...opts }: NetworkLogsClientOpts) =>
  createGeneratedClient(
    tokenFile ? { ...opts, getHeaders: projectedTokenHeaders(tokenFile) } : opts
  );
