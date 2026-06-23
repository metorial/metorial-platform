import { SkillPluginEditorScene } from '@metorial/scene-skills';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillPluginEditorPage = () => {
  let instance = useCurrentInstance();
  let { skillPluginId } = useParams();

  return (
    <SkillPluginEditorScene instanceId={instance.data?.id} skillPluginId={skillPluginId} />
  );
};
