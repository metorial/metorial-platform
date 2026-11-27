import { registerAdapterListener } from '@metorial-subspace/module-integration';
import {
  archiveChatConnectionProjection,
  upsertChatInstanceProjection,
  upsertChatInstanceProviderProjection,
  upsertChatConnectionProjection,
  upsertChatProviderProjection
} from './lib/project';

let registered = false;

export let registerChatAdapterListener = () => {
  if (registered) return;
  registered = true;

  registerAdapterListener('chat', {
    async onIntegrationArchived({ adapterIntegration }) {
      await archiveChatConnectionProjection(adapterIntegration.oid);
    },

    async onProvidersSynced({ adapterIntegration, providers }) {
      await upsertChatConnectionProjection(adapterIntegration);
      for (let provider of providers) {
        await upsertChatProviderProjection(provider);
      }
    },

    async onInstanceSynced({ adapterInstance }) {
      await upsertChatInstanceProjection(adapterInstance);
    },

    async onInstanceArchived({ adapterInstance }) {
      await upsertChatInstanceProjection(adapterInstance);
    },

    async onInstanceProvidersSynced({ adapterInstance, providers }) {
      await upsertChatInstanceProjection(adapterInstance);
      for (let provider of providers) {
        await upsertChatInstanceProviderProjection(provider);
      }
    }
  });
};

registerChatAdapterListener();
