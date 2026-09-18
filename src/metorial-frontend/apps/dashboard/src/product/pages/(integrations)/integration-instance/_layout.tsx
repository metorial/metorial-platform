import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateIntegrationInstanceSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstance
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiPuzzleLine } from '@remixicon/react';
import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  OpenExplorerButton,
  type OpenExplorerMode
} from '../../../components/openExplorer';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

let getIntegrationInstanceStatusColor = (status: string) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'orange';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export let IntegrationInstanceLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);
  let createSession = useCreateIntegrationInstanceSession();
  let [isCreatingSession, setIsCreatingSession] = useState(false);

  let handleOpenExplorer = async (mode: OpenExplorerMode) => {
    let activeIntegrationInstanceId = integrationInstance.data?.id ?? integrationInstanceId;
    if (
      isCreatingSession ||
      !instance.data ||
      !activeIntegrationInstanceId ||
      integrationInstance.data?.status !== 'active'
    )
      return;

    setIsCreatingSession(true);

    let [res] = await createSession.mutate({
      instanceId: instance.data.id,
      integrationInstanceId: activeIntegrationInstanceId
    });
    setIsCreatingSession(false);

    if (res) {
      navigate(
        Paths.instance.explorer(organization.data, project.data, instance.data, {
          session_id: res.id,
          mode
        }),
        {
          state: { integrationInstanceId: activeIntegrationInstanceId }
        }
      );
    }
  };

  let instancePathParams = [
    organization.data,
    project.data,
    instance.data,
    integrationInstance.data?.id ?? integrationInstanceId
  ] as const;

  return (
    <DetailsLayout
      entity={integrationInstance.data}
      icon={<RiPuzzleLine />}
      breadcrumbs={[
        {
          label: 'Integrations',
          to: Paths.instance.integrations(organization.data, project.data, instance.data)
        },
        {
          label: integration.data?.name ?? 'Integration',
          to: Paths.instance.integration(
            organization.data,
            project.data,
            instance.data,
            integrationInstance.data?.integrationId
          )
        },
        {
          label: integrationInstance.data?.name,
          to: Paths.instance.integrationInstance(...instancePathParams)
        }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.integrationInstance(...instancePathParams) },
        {
          label: 'Settings',
          to: Paths.instance.integrationInstance(...instancePathParams, 'settings')
        }
      ]}
      actions={[
        {
          type: 'custom',
          render: () => (
            <OpenExplorerButton
              size="2"
              variant="outline"
              onOpen={handleOpenExplorer}
              disabled={isCreatingSession || integrationInstance.data?.status !== 'active'}
              loading={isCreatingSession}
            />
          )
        }
      ]}
      attributes={
        integrationInstance.data
          ? [
              { label: 'ID', value: <ID id={integrationInstance.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge color={getIntegrationInstanceStatusColor(integrationInstance.data.status)}>
                    {capitalize(integrationInstance.data.status)}
                  </Badge>
                )
              },
              {
                label: 'Identity',
                value: integrationInstance.data.identityId ? (
                  <ID id={integrationInstance.data.identityId} />
                ) : (
                  '-'
                )
              },
              { label: 'Created', value: <RenderDate date={integrationInstance.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ integrationInstance })(({ integrationInstance }) => (
          <>
            <DeletedRecordCallout status={integrationInstance.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
