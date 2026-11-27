import { dynamicComponent } from '@metorial/dynamic-component';
import type { SkillStartInput as _SkillStartInput } from './components/skillStartInput';

export * from './scenes';

export let SkillAssistantDock = dynamicComponent(() =>
  import('./components/skillAssistantDock').then(m => m.SkillAssistantDock)
);

export let SkillStartInput = dynamicComponent<Parameters<typeof _SkillStartInput>>(() =>
  import('./components/skillStartInput').then(m => m.SkillStartInput)
);
