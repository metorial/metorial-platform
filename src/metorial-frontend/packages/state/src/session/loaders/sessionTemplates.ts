import {
  DashboardInstanceSessionTemplatesCreateBody,
  DashboardInstanceSessionTemplatesListQuery,
  DashboardInstanceSessionTemplatesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { mutation } from '../../lib/mutation';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let sessionTemplatesLoader = createLoader({
  name: 'sessionTemplates',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSessionTemplatesListQuery) =>
    withAuth(sdk => sdk.sessionTemplates.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateSessionTemplate = sessionTemplatesLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceSessionTemplatesCreateBody) =>
    withAuth(sdk => sdk.sessionTemplates.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteSessionTemplate = sessionTemplatesLoader.createExternalMutator(
  (i: { instanceId: string; sessionTemplateId: string }) =>
    withAuth(sdk => sdk.sessionTemplates.delete(i.instanceId, i.sessionTemplateId))
);

export let useSessionTemplates = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSessionTemplatesListQuery
) => {
  let data = usePaginator(pagination =>
    sessionTemplatesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let sessionTemplateLoader = createLoader({
  name: 'sessionTemplate',
  parents: [sessionTemplatesLoader],
  fetch: (i: { instanceId: string; sessionTemplateId: string }) =>
    withAuth(sdk => sdk.sessionTemplates.get(i.instanceId, i.sessionTemplateId)),
  mutators: {
    update: (
      body: { name?: string; description?: string; metadata?: Record<string, any> },
      { input: { instanceId, sessionTemplateId } }
    ) => withAuth(sdk => sdk.sessionTemplates.update(instanceId, sessionTemplateId, body)),
    delete: (_, { input: { instanceId, sessionTemplateId } }) =>
      withAuth(sdk => sdk.sessionTemplates.delete(instanceId, sessionTemplateId))
  }
});

export let useSessionTemplate = (
  instanceId: string | null | undefined,
  sessionTemplateId: string | null | undefined
) => {
  let data = sessionTemplateLoader.use(
    instanceId && sessionTemplateId ? { instanceId, sessionTemplateId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let createSessionTemplate = (
  i: DashboardInstanceSessionTemplatesCreateBody & { instanceId: string }
) => mutation(() => withAuth(sdk => sdk.sessionTemplates.create(i.instanceId, i)));

export let useUpdateSessionTemplate = sessionTemplatesLoader.createExternalMutator(
  (
    i: DashboardInstanceSessionTemplatesUpdateBody & {
      instanceId: string;
      sessionTemplateId: string;
    }
  ) => withAuth(sdk => sdk.sessionTemplates.update(i.instanceId, i.sessionTemplateId, i))
);
