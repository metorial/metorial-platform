import { useParams } from 'react-router-dom';
import { SkillSyncsTable } from '../skillSyncs';

export let SkillPluginSyncsPage = () => {
  let { skillPluginId } = useParams();

  return (
    <SkillSyncsTable
      emptyMessage="No syncs found for this skill plugin."
      query={skillPluginId ? { skillPluginId, order: 'desc' } : null}
    />
  );
};
