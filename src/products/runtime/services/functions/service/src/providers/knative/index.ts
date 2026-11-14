import { ProviderImpl } from '../_lib';
import { cloneFunctionVersion, deleteFunctionVersion, deployFunction } from './deploy';
import { invokeFunction } from './invoke';
import { provider } from './provider';
import { getRuntime } from './runtime';
import { workflow } from './workflow';

export let knativeProvider = new ProviderImpl({
  provider,
  workflow,
  getRuntime,
  deployFunction,
  cloneFunctionVersion,
  invokeFunction,
  deleteFunctionVersion
});
