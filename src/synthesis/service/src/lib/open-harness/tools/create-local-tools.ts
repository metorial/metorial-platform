import type { Environment } from '../providers/types';
import { createBashTool } from './create-bash-tool';
import { createFsTools, type CreateFsToolsOptions } from './create-fs-tools';

export function createLocalTools(env: Environment, options?: CreateFsToolsOptions) {
  return {
    ...createFsTools(env.fs, options),
    ...createBashTool(env.shell)
  };
}
