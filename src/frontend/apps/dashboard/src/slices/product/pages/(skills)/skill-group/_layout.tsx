import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillGroup
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SkillGroupLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillGroupId } = useParams();
  let skillGroup = useSkillGroup(instance.data?.id, skillGroupId);
  let pathname = useLocation().pathname;

  let skillGroupPathParams = [
    organization.data,
    project.data,
    instance.data,
    skillGroup.data?.id ?? skillGroupId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={skillGroup.data?.name ?? '...'}
        description={skillGroup.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skill Groups',
            href: Paths.instance.skillGroups(organization.data, project.data, instance.data)
          },
          {
            label: skillGroup.data?.name ?? '...',
            href: Paths.instance.skillGroup(...skillGroupPathParams)
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ skillGroup })(() => (
          <>
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.skillGroup(...skillGroupPathParams)
                },
                {
                  label: 'Settings',
                  to: Paths.instance.skillGroup(...skillGroupPathParams, 'settings')
                }
              ]}
            />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
