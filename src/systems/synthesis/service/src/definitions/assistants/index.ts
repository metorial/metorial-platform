import { explorerAssistant } from './explorer/assistant';
import { skillsAssistant } from './skills/assistant';

export * from './explorer/assistant';
export * from './skills/assistant';

export let assistants = {
  explorer: explorerAssistant,
  skills: skillsAssistant
};
