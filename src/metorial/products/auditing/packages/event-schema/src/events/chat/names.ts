export let chatEventNames = [
  'chat.message.received',
  'chat.message.updated',
  'chat.message.deleted',
  'chat.mention.received',
  'chat.reaction.added',
  'chat.reaction.removed',
  'chat.command.invoked',
  'chat.member.joined',
  'chat.member.left'
] as const;

export type ChatEventName = (typeof chatEventNames)[number];

export let chatEventDescriptions: Record<ChatEventName, string> = {
  'chat.message.received': 'A message was received in a connected chat.',
  'chat.message.updated': 'A message was updated in a connected chat.',
  'chat.message.deleted': 'A message was deleted from a connected chat.',
  'chat.mention.received': 'A mention was received in a connected chat.',
  'chat.reaction.added': 'A reaction was added to a message in a connected chat.',
  'chat.reaction.removed': 'A reaction was removed from a message in a connected chat.',
  'chat.command.invoked': 'A command was invoked in a connected chat.',
  'chat.member.joined': 'A member joined a connected chat.',
  'chat.member.left': 'A member left a connected chat.'
};
