import { ProviderImpl } from '../_lib';
import { checkLambdaAccess } from './access';
import { deployFunction } from './deploy';
import { invokeFunction } from './invoke';
import { provider } from './provider';
import { getRuntime } from './runtime';
import { workflow } from './workflow';

export let awsLambda = new ProviderImpl({
  provider,
  workflow,
  getRuntime,
  deployFunction,
  invokeFunction
});

if (process.env.NODE_ENV == 'production') {
  await checkLambdaAccess();
}
