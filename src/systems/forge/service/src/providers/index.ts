import type { IQueue, IQueueProcessor } from '@lowerdeck/queue';
import { env } from '../env';
import { AwsCodeBuildAdapter } from './aws-codebuild';
import { LocalBuildAdapter } from './local';

let adapter =
  env.provider.DEFAULT_PROVIDER === 'local'
    ? new LocalBuildAdapter()
    : new AwsCodeBuildAdapter();

export let startBuildQueue: IQueue<{ runId: string }, any> = adapter.startBuildQueue;
export let buildProviderProcessors: IQueueProcessor = adapter.buildProviderProcessors;
