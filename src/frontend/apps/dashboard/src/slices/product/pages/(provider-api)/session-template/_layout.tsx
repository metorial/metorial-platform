import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionTemplate
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SessionTemplateLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);

  let pathname = useLocation().pathname;

  let templatePathParams = [
    organization.data,
    project.data,
    instance.data,
    template.data?.id ?? sessionTemplateId
  ] as const;

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
