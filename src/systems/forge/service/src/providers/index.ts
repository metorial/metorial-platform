import { env } from '../env';
import { awsCodeBuildAdapter } from './aws-codebuild';
import { localBuildAdapter } from './local';

let adapter =
  env.provider.DEFAULT_PROVIDER === 'local' ? localBuildAdapter : awsCodeBuildAdapter;

export let startBuildQueue = adapter.startBuildQueue;
export let buildProviderProcessors = adapter.buildProviderProcessors;
