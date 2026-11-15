import { v } from '@lowerdeck/validation';
import type { GetTypeOfPresentable } from '@metorial/presenter';
import { chatEventPresenter } from '@metorial/presenters';
import { event } from '../../_lib/event';
import { type ChatEventName, chatEventDescriptions, chatEventNames } from './names';

type ChatEventInput = GetTypeOfPresentable<typeof chatEventPresenter.type>;

let chatEvent = <Name extends ChatEventName>(name: Name) =>
  event({
    name,
    description: chatEventDescriptions[name],
    payload: v.typedAny<ChatEventInput>('chat_event'),
    presenter: chatEventPresenter
  });

export let chatEvents = Object.fromEntries(
  chatEventNames.map(name => [name, chatEvent(name)])
) as { [Name in ChatEventName]: ReturnType<typeof chatEvent<Name>> };
