import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkill
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SkillLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let pathname = useLocation().pathname;

  let skillPathParams = [
    organization.data,
    project.data,
    instance.data,
    skill.data?.id ?? skillId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={skill.data?.name ?? '...'}
        description={skill.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skills',
            href: Paths.instance.skills(organization.data, project.data, instance.data)
          },
          {
            label: skill.data?.name ?? '...',
            href: Paths.instance.skill(...skillPathParams)
          }
        ]}
      />

      {renderWithLoader({ skill })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.skill(...skillPathParams)
              },
              {
                label: 'Settings',
                to: `${Paths.instance.skill(...skillPathParams)}/settings`
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
