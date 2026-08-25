import type { ChannelOptions } from '@grpc/grpc-js';
import { ChannelCredentials, createChannel, createClient, type Client } from 'nice-grpc';
import { CodeBucketService } from './ts-proto-gen/rpc';

export let createCodeBucketClient = (opts: {
  address: string;
  credentials?: ChannelCredentials;
  options?: ChannelOptions;
}) => {
  let channel = createChannel(
    opts.address,
    opts.credentials || ChannelCredentials.createInsecure(),
    {
      ...opts.options,

      'grpc.max_receive_message_length': 500 * 1024 * 1024,
      'grpc.max_send_message_length': 500 * 1024 * 1024,

      'grpc.keepalive_time_ms': 60000, // 60s between pings (when idle)
      'grpc.keepalive_timeout_ms': 20000, // 20s to wait for ping ACK
      'grpc.keepalive_permit_without_calls': 0, // Don't ping if no RPC is active

      'grpc.initial_reconnect_backoff_ms': 1000, // Start reconnect at 1s
      'grpc.max_reconnect_backoff_ms': 5000 // Cap backoff at 5s
    }
  );

  let client: Client<CodeBucketService> = createClient(CodeBucketService, channel);

  return client;
};

export type McpManagerClient = Client<CodeBucketService>;
