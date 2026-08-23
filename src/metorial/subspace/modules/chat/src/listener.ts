import { registerAdapterListener } from '@metorial-subspace/module-integration';
import {
  archiveChatIntegrationProjection,
  upsertChatInstanceProjection,
  upsertChatInstanceProviderProjection,
  upsertChatIntegrationProjection,
  upsertChatProviderProjection
} from './lib/project';

let registered = false;

export let registerChatAdapterListener = () => {
  if (registered) return;
  registered = true;

  registerAdapterListener('chat', {
    async onIntegrationArchived({ adapterIntegration }) {
      await archiveChatIntegrationProjection(adapterIntegration.oid);
    },

    async onProvidersSynced({ adapterIntegration, providers }) {
      await upsertChatIntegrationProjection(adapterIntegration);
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
