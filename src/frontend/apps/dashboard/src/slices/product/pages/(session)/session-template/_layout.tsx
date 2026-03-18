import {
  DashboardInstanceSessionsCreateOutput,
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionTemplate,
  useSessionTemplateProviders
} from '@metorial/state';
import { Button, Flex, LinkTabs } from '@metorial/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showAddProviderModal } from '../../../scenes/sessionTemplates/providersManager';

export let SessionTemplateLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let providers = useSessionTemplateProviders(instance.data?.id, sessionTemplateId);
  let createSession = useCreateSession(instance.data?.id);
  let [isCreatingSession, setIsCreatingSession] = useState(false);

  let pathname = useLocation().pathname;

  let templatePathParams = [
    organization.data,
    project.data,
    instance.data,
    template.data?.id ?? sessionTemplateId
  ] as const;

  let getFirstSessionDeploymentId = (
    session: DashboardInstanceSessionsCreateOutput
  ): string | null => session.providers[0]?.deployment?.id ?? null;

  let handleOpenExplorer = async () => {
    let activeSessionTemplateId = template.data?.id ?? sessionTemplateId;
    if (
      isCreatingSession ||
      !instance.data ||
      !activeSessionTemplateId ||
      !providers.data?.items.length
    )
      return;

    setIsCreatingSession(true);

    let [res] = await createSession.mutate({
      providers: [{ sessionTemplateId: activeSessionTemplateId }]
    });
    setIsCreatingSession(false);

    if (res) {
      let firstDeploymentId =
        getFirstSessionDeploymentId(res) ??
        providers.data.items.find(
          (
            provider
          ): provider is DashboardInstanceSessionTemplatesProvidersListOutput['items'][number] & {
            deployment: { id: string };
          } => !!provider.deployment?.id
        )?.deployment.id ??
        null;
      if (firstDeploymentId) {
        navigate(
          Paths.instance.explorer(organization.data, project.data, instance.data, {
            provider_deployment_id: firstDeploymentId,
            session_id: res.id
          })
        );
      }
    }
  };

  return (
    <ContentLayout>
      <PageHeader
        title={template.data?.name ?? '...'}
        description={template.data?.description ?? undefined}
        pagination={[
          {
            label: 'Templates',
            href: Paths.instance.sessionTemplates(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: template.data?.name,
            href: Paths.instance.sessionTemplate(
              organization.data,
              project.data,
              instance.data,
              template.data?.id ?? sessionTemplateId
            )
          }
        ]}
        actions={
          instance.data ? (
            <Flex gap={8}>
              <Button
                size="2"
                variant="outline"
                onClick={handleOpenExplorer}
                disabled={isCreatingSession || !providers.data?.items?.length}
                loading={isCreatingSession}
              >
                Open Explorer
              </Button>

              <Button
                size="2"
                onClick={() =>
                  showAddProviderModal({
                    instanceId: instance.data!.id,
                    sessionTemplateId: sessionTemplateId!,
                    onComplete: () => providers.refetch()
                  })
                }
              >
                Add Provider
              </Button>
            </Flex>
          ) : undefined
        }
      />

      {renderWithLoader({ template })(({ template }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.sessionTemplate(...templatePathParams)
              },
              {
                label: 'Providers',
                to: Paths.instance.sessionTemplate(...templatePathParams, 'providers')
              },
              {
                label: 'Settings',
                to: Paths.instance.sessionTemplate(...templatePathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
