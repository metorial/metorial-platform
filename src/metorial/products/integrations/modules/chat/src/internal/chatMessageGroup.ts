import { Service } from '@lowerdeck/service';
import { type ChatPart } from '@metorial-subspace/adapter-chat';
import { type ChatChannel, type ChatMessage, db, getId } from '@metorial-subspace/db';

let messageHasTextContent = (message: Pick<ChatMessage, 'body'>) => {
  let body = message.body as { parts?: ChatPart[] } | null;
  if (!body?.parts?.length) return false;

  return body.parts.some(part => {
    if (part.type === 'markdown') return !!part.markdown?.trim();
    if (part.type === 'text') return !!part.content?.trim();
    return false;
  });
};

class chatMessageGroupServiceInternalImpl {
  async setGroupPrimary(d: { groupOid: bigint; primaryMessageOid: bigint }) {
    await db.chatMessageGroup.update({
      where: { oid: d.groupOid },
      data: { primaryMessageOid: d.primaryMessageOid }
    });
    await db.chatMessage.update({
      where: { oid: d.primaryMessageOid },
      data: { isChildMessage: false }
    });
    await db.chatMessage.updateMany({
      where: { groupOid: d.groupOid, oid: { not: d.primaryMessageOid } },
      data: { isChildMessage: true }
    });
  }

  async createGroupForMessages(d: { channel: ChatChannel; messages: ChatMessage[] }) {
    if (d.messages.length < 2) return;

    let group = await db.chatMessageGroup.create({
      data: { ...getId('chatMessageGroup'), channelOid: d.channel.oid }
    });

    await db.chatMessage.updateMany({
      where: { oid: { in: d.messages.map(message => message.oid) } },
      data: { groupOid: group.oid }
    });

    let primary = d.messages.find(messageHasTextContent) ?? d.messages[0]!;
    await this.setGroupPrimary({ groupOid: group.oid, primaryMessageOid: primary.oid });
  }

  async attachInboundMessageToGroup(d: {
    channel: ChatChannel;
    message: ChatMessage;
    providerGroupKey: string;
  }) {
    if (d.message.groupOid) return;

    let group = await db.chatMessageGroup.upsert({
      where: {
        channelOid_providerGroupKey: {
          channelOid: d.channel.oid,
          providerGroupKey: d.providerGroupKey
        }
      },
      create: {
        ...getId('chatMessageGroup'),
        channelOid: d.channel.oid,
        providerGroupKey: d.providerGroupKey
      },
      update: {}
    });

    await db.chatMessage.update({
      where: { oid: d.message.oid },
      data: { groupOid: group.oid }
    });

    if (!group.primaryMessageOid) {
      await this.setGroupPrimary({ groupOid: group.oid, primaryMessageOid: d.message.oid });
      return;
    }

    if (!messageHasTextContent(d.message)) return;

    let currentPrimary = await db.chatMessage.findUnique({
      where: { oid: group.primaryMessageOid }
    });
    if (!currentPrimary || !messageHasTextContent(currentPrimary)) {
      await this.setGroupPrimary({ groupOid: group.oid, primaryMessageOid: d.message.oid });
    }
  }
}

export let chatMessageGroupServiceInternal = Service.create(
  'chatMessageGroupServiceInternal',
  () => new chatMessageGroupServiceInternalImpl()
).build();
