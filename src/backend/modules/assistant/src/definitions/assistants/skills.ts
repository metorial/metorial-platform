import { assistant } from '../../lib/definitions';
import { skillsAssistantImplementation } from '../implementations/skills';

export let skillsAssistant = assistant({
  slug: 'skills',
  name: 'Skills Assistant',
  systemIdentifier: 'skills',
  implementation: skillsAssistantImplementation
});
