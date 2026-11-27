import { Controller } from '@metorial/rest';
import { assistantHandlers } from './assistants';
import { assistantConversationHandlers } from './conversations';
import { assistantMessageHandlers } from './messages';

export let dashboardAssistantController = Controller.create(
  {
    name: 'Assistants',
    description: 'Assistant and conversation endpoints'
  },
  {
    ...assistantHandlers,
    ...assistantConversationHandlers,
    ...assistantMessageHandlers
  }
);
