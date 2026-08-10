import { assistant } from '../../../lib/definitions';
import { testAssistantImplementation } from './impl';

export let testAssistant = assistant({
  slug: 'test',
  name: 'Test Assistant',
  systemIdentifier: 'test',
  implementation: testAssistantImplementation
});
