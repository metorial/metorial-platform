import { assistant } from '../../../lib/definitions';
import { skillsAssistantImplementation } from './impl';

export let skillsAssistant = assistant({
  slug: 'skills',
  name: 'Skills Assistant',
  systemIdentifier: 'skills',
  implementation: skillsAssistantImplementation
});
