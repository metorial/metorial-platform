import { env } from '../env';
import { AwsCodeBuildAdapter } from './aws-codebuild';
import { LocalBuildAdapter } from './local';

let adapter =
  env.provider.DEFAULT_PROVIDER === 'local'
    ? new LocalBuildAdapter()
    : new AwsCodeBuildAdapter();

export let startBuildQueue = adapter.startBuildQueue;
export let buildProviderProcessors = adapter.buildProviderProcessors;
