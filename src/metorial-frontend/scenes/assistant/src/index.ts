import { dynamicComponent } from '@metorial/dynamic-component';

export * from './scenes';

export let SkillAssistantDock = dynamicComponent(() =>
  import('./components/skillAssistantDock').then(m => m.SkillAssistantDock)
);
