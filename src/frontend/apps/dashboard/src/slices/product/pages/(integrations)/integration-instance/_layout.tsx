import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateIntegrationInstanceSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstance
} from '@metorial/state';
import { Button, Flex, LinkTabs } from '@metorial/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

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
  let pathname = useLocation().pathname;

  let handleOpenExplorer = async () => {
    let activeIntegrationInstanceId =
      integrationInstance.data?.id ?? integrationInstanceId;
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
          session_id: res.id
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
    <ContentLayout>
      <PageHeader
        title={integrationInstance.data?.name ?? '...'}
        description={integrationInstance.data?.description ?? undefined}
        pagination={[
          {
            label: 'Integrations',
            href: Paths.instance.integrations(organization.data, project.data, instance.data)
          },
          {
            label: integration.data?.name ?? 'Integration',
            href: Paths.instance.integration(
              organization.data,
              project.data,
              instance.data,
              integrationInstance.data?.integrationId
            )
          },
          {
            label: integrationInstance.data?.name,
            href: Paths.instance.integrationInstance(...instancePathParams)
          }
        ]}
        actions={
          instance.data ? (
            <Flex gap={8}>
              <Button
                size="2"
                variant="outline"
                onClick={handleOpenExplorer}
                disabled={
                  isCreatingSession || integrationInstance.data?.status !== 'active'
                }
                loading={isCreatingSession}
              >
                Open Explorer
              </Button>
            </Flex>
          ) : undefined
        }
      />

      {renderWithLoader({ integrationInstance })(({ integrationInstance }) => (
        <>
          <DeletedRecordCallout status={integrationInstance.data.status} />

          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.integrationInstance(...instancePathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.integrationInstance(...instancePathParams, 'settings')
              }
            ]}
          />
          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
