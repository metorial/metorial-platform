export let propagationDelayMs = 15_000;

export type LifecycleResource =
  | 'skill'
  | 'plugin'
  | 'pluginSkill'
  | 'marketplace'
  | 'marketplacePlugin'
  | 'configuration'
  | 'store'
  | 'document';

export type LifecycleEvent = 'created' | 'updated' | 'archived';
export type StoreLifecycleEvent = LifecycleEvent | 'contents-changed';

export let getLifecycleJobId = (resource: LifecycleResource, id: string) =>
  `${resource}:${id}`;

export let getPropagationJobOpts = (resource: LifecycleResource, id: string) => ({
  id: getLifecycleJobId(resource, id),
  delay: propagationDelayMs
});
