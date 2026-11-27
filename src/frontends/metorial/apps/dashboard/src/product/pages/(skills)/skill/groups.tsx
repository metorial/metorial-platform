import { Paths } from '@metorial/frontend-config';
import { SkillGroupsForSkillScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkill,
  useStorePermissions
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillGroupsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let storePermissions = useStorePermissions(instance.data?.id, skill.data?.storeId);
  let canWriteStore =
    storePermissions.data?.hasFullAccess ||
    storePermissions.data?.permissions.includes('content_write');

  return (
    <SkillGroupsForSkillScene
      instanceId={instance.data?.id}
      skillId={skillId}
      getSkillGroupPath={skillGroupId =>
        Paths.instance.skillGroup(organization.data, project.data, instance.data, skillGroupId)
      }
      readOnly={!canWriteStore}
    />
  );
};
