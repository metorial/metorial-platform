import { SkillParticipantsScene } from '@metorial/scene-skills';
import { useCurrentInstance, useCurrentOrganization } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillParticipantsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let { skillId } = useParams();

  return (
    <SkillParticipantsScene
      instanceId={instance.data?.id}
      skillId={skillId}
      shareContext={
        skillId
          ? {
              mode: 'dashboard',
              organizationId: organization.data?.id,
              skills: [{ id: skillId }]
            }
          : null
      }
    />
  );
};
