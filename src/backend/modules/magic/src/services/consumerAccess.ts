import { accessTagService, type AnyAccessTagSelector, type Scope } from '@metorial/module-access';

export type AccessTagFilter = Awaited<ReturnType<(typeof accessTagService)['getAccessTagFilter']>>;

export let getAccessTagFilter = async (d: {
  accessTags?: AnyAccessTagSelector;
  roles: Scope[];
}): Promise<AccessTagFilter> => {
  if (!d.accessTags) return undefined;

  return await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: d.roles
  });
};

export let getActiveStatusFilter = <TStatus extends string>(d: {
  accessTags?: AnyAccessTagSelector;
  status?: TStatus[];
  activeStatus: TStatus;
}) => {
  if (!d.accessTags) return d.status;

  return d.status?.filter(status => status === d.activeStatus) ?? [d.activeStatus];
};
