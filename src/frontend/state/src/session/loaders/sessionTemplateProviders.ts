import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { sessionTemplatesLoader } from './sessionTemplates';

export let sessionTemplateProvidersLoader = createLoader({
  name: 'sessionTemplateProviders',
  parents: [sessionTemplatesLoader],
  fetch: (i: { instanceId: string; sessionTemplateId: string }) =>
    withAuth(sdk => sdk.sessionTemplates.providers.list(i.instanceId, i.sessionTemplateId)),
  mutators: {}
});

export let useSessionTemplateProviders = (
  instanceId: string | null | undefined,
  sessionTemplateId: string | null | undefined
) => {
  let data = usePaginator(pagination =>
    sessionTemplateProvidersLoader.use(
      instanceId && sessionTemplateId
        ? { instanceId, sessionTemplateId, ...pagination }
        : null
    )
  );

  return data;
};

export let useDeleteSessionTemplateProvider =
  sessionTemplateProvidersLoader.createExternalMutator(
    (i: {
      instanceId: string;
      sessionTemplateId: string;
      sessionTemplateProviderId: string;
    }) =>
      withAuth(sdk =>
        sdk.sessionTemplates.providers.delete(
          i.instanceId,
          i.sessionTemplateId,
          i.sessionTemplateProviderId
        )
      ),
    { disableToast: true }
  );
