import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { SkillsGrid } from '../../../scenes/skills/grid';

export let SkillsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <SkillsGrid instanceId={instance.data.id} />
  ));
};
