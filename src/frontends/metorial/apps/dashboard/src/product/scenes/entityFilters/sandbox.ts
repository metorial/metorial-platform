import { sandboxMachinesLoader, sandboxImagesLoader } from '@metorial/state/src/sandbox';
import {
  defineEntityFilter,
  useEntityList,
  type EntityFilterOptions,
  type EntityListQuery
} from './define';

type InstanceId = string | null | undefined;

let listParams = (instanceId: InstanceId, q: EntityListQuery | null) =>
  instanceId && q ? { instanceId, search: q.search, id: q.ids, limit: q.limit } : null;

export let sandboxFilters = {
  sandboxMachine: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'machineId',
      label: 'Machine',
      noun: 'machines',
      mode: 'search',
      useList: q =>
        useEntityList(sandboxMachinesLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.slug || item.id,
          slug: item.slug ?? undefined
        }))
    })(opts),

  sandboxImage: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'imageId',
      label: 'Image',
      noun: 'images',
      mode: 'search',
      useList: q =>
        useEntityList(sandboxImagesLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.identifier || item.id,
          slug: item.identifier ?? undefined
        }))
    })(opts)
};
