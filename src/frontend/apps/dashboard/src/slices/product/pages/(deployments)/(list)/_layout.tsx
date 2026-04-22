import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { showSessionTemplateFormModal } from '../../../scenes/sessionTemplates/modal';

export { ProviderDeploymentsListLayout } from './providerDeploymentsListLayout';

export let ProvidersListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader title="Providers" description="Browse and deploy providers on Metorial." />
      <Outlet />
    </ContentLayout>
  );
};

export let ProvidersHubLayout = ProvidersListLayout;

export let SessionTemplatesListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Session Templates"
        description="Create reusable session configurations for quick deployment."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showSessionTemplateFormModal({
                type: 'create',
                instanceId: instance.data.id,
                onCreate: template => {
                  if (!instance.data) return;

                  navigate(
                    Paths.instance.sessionTemplate(
                      organization.data,
                      project.data,
                      instance.data,
                      template.id
                    )
                  );
                }
              })
            }
          >
            Create Template
          </Button>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ProviderSessionsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Session Logs"
        description="View detailed logs of provider connections, including connections and errors."
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Sessions',
            to: Paths.instance.providerSessions(organization.data, project.data, instance.data)
          },
          {
            label: 'Provider Runs',
            to: Paths.instance.providerRuns(organization.data, project.data, instance.data)
          },
          {
            label: 'Errors',
            to: Paths.instance.providerErrors(organization.data, project.data, instance.data)
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
