import { projectedTokenHeaders, type ClientOpts } from '@lowerdeck/rpc-client';
import { createClusterManagerClient as createGeneratedClient } from './generated';

export * from './generated';

export type ClusterManagerClientOpts = ClientOpts & {
  tokenFile?: string;
};

export let createClusterManagerClient = ({ tokenFile, ...opts }: ClusterManagerClientOpts) =>
  createGeneratedClient(
    tokenFile ? { ...opts, getHeaders: projectedTokenHeaders(tokenFile) } : opts
  );
