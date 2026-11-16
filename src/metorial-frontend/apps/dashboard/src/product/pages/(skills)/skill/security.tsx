import { SkillSecurityScene } from '@metorial/scene-skills';
import { useCurrentInstance, useSkill, useStorePermissions } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillSecurityPage = () => {
  let instance = useCurrentInstance();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let storePermissions = useStorePermissions(instance.data?.id, skill.data?.storeId);
  let canWrite =
    !!storePermissions.data?.hasFullAccess ||
    !!storePermissions.data?.permissions.includes('content_write');

  return (
    <SkillSecurityScene
      instanceId={instance.data?.id}
      skillId={skill.data?.id}
      canWrite={canWrite}
      canDismiss
    />
  );
};
