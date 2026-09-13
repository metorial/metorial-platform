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
