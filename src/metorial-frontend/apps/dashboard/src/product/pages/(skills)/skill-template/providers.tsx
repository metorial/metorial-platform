import { SkillTemplateLinkProvidersScene } from '@metorial/scene-skills';
import { useCurrentInstance, useSkillTemplate } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillTemplateProvidersPage = () => {
  let instance = useCurrentInstance();
  let { skillTemplateId } = useParams();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);

  return (
    <SkillTemplateLinkProvidersScene
      instanceId={instance.data?.id}
      skillTemplateId={skillTemplateId}
      readOnly={skillTemplate.data?.owner === 'system'}
    />
  );
};
