import { explorerAssistant } from './explorer/assistant';
import { skillsAssistant } from './skillEditor/assistant';
import { testAssistant } from './test/assistant';

export * from './explorer/assistant';
export * from './skillEditor/assistant';

export let assistants = {
  explorer: explorerAssistant,
  skills: skillsAssistant,
  test: testAssistant
};
