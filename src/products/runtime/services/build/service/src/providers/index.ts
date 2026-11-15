import type { IQueue, IQueueProcessor } from '@lowerdeck/queue';
import { env } from '../env';
import type { ForgeBuildAdapter } from './_lib/adapter';
import { AwsCodeBuildAdapter } from './aws-codebuild';
import { KubernetesBuildAdapter } from './kubernetes';
import { LocalBuildAdapter } from './local';

let createAdapter = (): ForgeBuildAdapter => {
  if (env.provider.DEFAULT_PROVIDER === 'local') return new LocalBuildAdapter();
  if (env.provider.DEFAULT_PROVIDER === 'kubernetes') return new KubernetesBuildAdapter();
  return new AwsCodeBuildAdapter();
};

let adapter = createAdapter();

export let startBuildQueue: IQueue<{ runId: string }, any> = adapter.startBuildQueue;
export let buildProviderProcessors: IQueueProcessor = adapter.buildProviderProcessors;
