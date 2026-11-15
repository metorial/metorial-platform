import { assistant } from '../../../lib/definitions';
import { skillEditorAssistantImplementation } from './impl';

export let skillsAssistant = assistant({
  slug: 'skills',
  name: 'Skills Assistant',
  systemIdentifier: 'skills',
  implementation: skillEditorAssistantImplementation
});
