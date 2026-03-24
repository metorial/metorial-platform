import type {
  Callback,
  CallbackProviderTrigger,
  Provider,
  ProviderDeployment,
  ProviderTrigger
} from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';

export let callbackPresenter = (
  callback: Callback & {
    providerDeployment: ProviderDeployment & {
      provider: Provider;
    };
    callbackProviderTriggers: (CallbackProviderTrigger & {
      providerTrigger: ProviderTrigger;
    })[];
  }
) => ({
  object: 'callback',

  id: callback.id,
  status: callback.status,

  name: callback.name,
  description: callback.description,
  metadata: callback.metadata,

  pollIntervalSecondsOverride: callback.pollIntervalSecondsOverride,

  providerDeployment: providerDeploymentPreviewPresenter(callback.providerDeployment),

  providerTriggers: callback.callbackProviderTriggers.map(trigger => ({
    object: 'callback.provider_trigger',
    id: trigger.id,
    providerTriggerId: trigger.providerTrigger.id,
    providerTriggerKey: trigger.providerTrigger.key,
    providerTriggerName: trigger.providerTrigger.name,
    eventTypes: trigger.eventTypes,
    createdAt: trigger.createdAt
  })),

  createdAt: callback.createdAt,
  updatedAt: callback.updatedAt
});
