import { SkillParticipantsScene } from '@metorial/scene-skills';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillParticipantsPage = () => {
  let instance = useCurrentInstance();
  let { skillId } = useParams();

  return <SkillParticipantsScene instanceId={instance.data?.id} skillId={skillId} />;
};
