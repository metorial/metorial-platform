import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useInstanceContext, withProviderNames } from '../../../lib/dataList';
import { ProviderSessionContent } from './_content';

type SessionDeployment = {
  id: string;
  providerId: string;
  deploymentId?: string;
  deploymentName?: string | null;
  createdAt: Date | string;
};

let SessionProvidersList = createDataList<{ session: DashboardInstanceSessionsGetOutput }>(
  'provider-session-providers',
  { customizable: false }
)
  .context(useInstanceContext)
  .items(({ props }) => ({
    items: useMemo<SessionDeployment[]>(
      () =>
        (props.session.providers ?? []).map(dep => ({
          id: dep.deployment?.id ?? dep.providerId,
          providerId: dep.providerId,
          deploymentId: dep.deployment?.id,
          deploymentName: dep.deployment?.name,
          createdAt: props.session.createdAt
        })),
      [props.session]
    )
  }))
  .enrich(withProviderNames((row: SessionDeployment) => row.providerId))
  .columns([
    col.text({
      id: 'deployment',
      header: 'Deployment',
      weight: 'strong',
      fallback: 'Unnamed',
      get: row => row.deploymentName
    }),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => row.providerName ?? row.providerId
    }),
    col.createdAt()
  ])
  .link((row, _props, ctx) =>
    row.deploymentId
      ? Paths.instance.providerDeployment(
          ctx.organization,
          ctx.project,
          ctx.instance,
          row.deploymentId
        )
      : undefined
  )
  .build();

export let ProviderSessionProvidersPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <ProviderSessionProviders
      organization={organization.data}
      project={project.data}
      instance={instance.data}
      session={session.data}
    />
  ));
};

export let ProviderSessionProviders = ({
  session
}: {
  organization?: ReturnType<typeof useCurrentOrganization>['data'];
  project?: ReturnType<typeof useCurrentProject>['data'];
  instance?: ReturnType<typeof useCurrentInstance>['data'];
  session: DashboardInstanceSessionsGetOutput;
}) => (
  <ProviderSessionContent>
    <SessionProvidersList
      session={session}
      listVariant="embedded"
      hideToolbar
      emptyState="No provider deployments in this session."
    />
  </ProviderSessionContent>
);
