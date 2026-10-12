import {
  InitialLoadBoundary,
  PaginationSearchParamsProvider,
  renderWithLoader
} from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment,
  useDashboardFlags
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiFlowChart } from '@remixicon/react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { OpenExplorerButton } from '../../../components/openExplorer';

export let ConfigurationsDeploymentLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);

  let location = useLocation();
  let flags = useDashboardFlags();
  let navigate = useNavigate();
  let networkingEnabled = !!flags.data?.flags['networking-enabled'];

  let params = [
    organization.data,
    project.data,
    instance.data,
    deployment.data?.id ?? providerDeploymentId
  ] as const;
  let path = (...subPages: string[]) =>
    `${Paths.instance.providerDeployment(...params, ...subPages)}${location.search}`;

  return (
    <DetailsLayout
      entity={deployment.data}
      icon={<RiFlowChart />}
      breadcrumbs={[
        {
          label: 'Deployments',
          to: Paths.instance.providerDeployments(
            organization.data,
            project.data,
            instance.data
          )
        },
        { label: deployment.data?.name, to: path() }
      ]}
      tabs={[
        { label: 'Overview', to: path() },
        { label: 'Auth Configs', to: path('auth-configs') },
        { label: 'Configs', to: path('configs') },
        ...(networkingEnabled ? [{ label: 'Network', to: path('network') }] : []),
        { label: 'Settings', to: path('settings') }
      ]}
      actions={[
        {
          label: 'View Provider',
          variant: 'outline',
          disabled: !deployment.data,
          onClick: () =>
            navigate(
              Paths.instance.provider(
                organization.data,
                project.data,
                instance.data,
                deployment.data?.providerId
              )
            )
        },
        {
          type: 'custom',
          render: () => (
            <OpenExplorerButton
              disabled={!deployment.data}
              to={Paths.instance.explorer(organization.data, project.data, instance.data, {
                provider_deployment_id: deployment.data?.id ?? providerDeploymentId
              })}
            />
          )
        }
      ]}
      attributes={
        deployment.data
          ? [
              { label: 'ID', value: <ID id={deployment.data.id} /> },
              { label: 'Created', value: <RenderDate date={deployment.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ deployment })(() => (
          <>
            <DeletedRecordCallout status={deployment.data?.status} />
            <PaginationSearchParamsProvider enabled>
              <Outlet />
            </PaginationSearchParamsProvider>
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
