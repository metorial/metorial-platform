import { dynamicComponent } from '@metorial/dynamic-component';
import type { AssistantConversationScene as _AssistantConversationScene } from './conversation';
import type { AssistantStartScene as _AssistantStartScene } from './start';

export let AssistantConversationScene = dynamicComponent<
  Parameters<typeof _AssistantConversationScene>
>(() => import('./conversation').then(m => m.AssistantConversationScene));

export let AssistantStartScene = dynamicComponent<Parameters<typeof _AssistantStartScene>>(
  () => import('./start').then(m => m.AssistantStartScene)
);
