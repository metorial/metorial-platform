import type { SlateCallbackConfig } from '../../prisma/generated/client';

export let slateCallbackConfigPresenter = (config: SlateCallbackConfig) => ({
  id: config.id,
  configuredKeys: config.configuredKeys,
  createdAt: config.createdAt
});
