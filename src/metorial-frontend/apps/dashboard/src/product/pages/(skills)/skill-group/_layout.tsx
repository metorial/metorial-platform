import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillGroup
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiGroupLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';

export let SkillGroupLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillGroupId } = useParams();
  let skillGroup = useSkillGroup(instance.data?.id, skillGroupId);

  let skillGroupPathParams = [
    organization.data,
    project.data,
    instance.data,
    skillGroup.data?.id ?? skillGroupId
  ] as const;

  return (
    <DetailsLayout
      entity={skillGroup.data}
      icon={<RiGroupLine />}
      breadcrumbs={[
        {
          label: 'Skill Groups',
          to: Paths.instance.skillGroups(organization.data, project.data, instance.data)
        },
        {
          label: skillGroup.data?.name,
          to: Paths.instance.skillGroup(...skillGroupPathParams)
        }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.skillGroup(...skillGroupPathParams) },
        {
          label: 'Settings',
          to: Paths.instance.skillGroup(...skillGroupPathParams, 'settings')
        }
      ]}
      attributes={
        skillGroup.data
          ? [
              { label: 'ID', value: <ID id={skillGroup.data.id} /> },
              { label: 'Status', value: <Badge color="gray">{skillGroup.data.status}</Badge> },
              { label: 'Skills', value: `${skillGroup.data.skills.length}` },
              { label: 'Created', value: <RenderDate date={skillGroup.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ skillGroup })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
