import { assistant } from '../../../lib/definitions';
import { explorerAssistantImplementation } from './impl';

export let explorerAssistant = assistant({
  slug: 'explorer',
  name: 'Explorer Assistant',
  systemIdentifier: 'explorer',
  implementation: explorerAssistantImplementation
});
