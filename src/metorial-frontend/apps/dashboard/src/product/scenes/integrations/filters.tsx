import { f, lifecycleStatus } from '@metorial/data-list';
import { entityFilters } from '../entityFilters';

export let integrationFilterDefs = (instanceId: string | undefined) => ({
  status: f.status(lifecycleStatus),
  providerId: f.entity(entityFilters.provider(instanceId)),
  createdAt: f.createdAt(),
  updatedAt: f.updatedAt()
});
