import type { ChatMessage } from '@metorial/state';
import { useCreateChatMessageReaction, useDeleteChatMessageReaction } from '@metorial/state';
import { Menu, Tooltip, theme } from '@metorial/ui';
import { RiEmotionLine } from '@remixicon/react';
import styled from 'styled-components';
import { getEmojiShortcode, quickReactions, resolveEmoji } from './emoji';

let Wrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
`;

let Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.gray150};
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  color: ${theme.colors.gray800};

  &:hover {
    border-color: ${theme.colors.gray550};
    background: ${theme.colors.gray250};
  }

  &[data-mine='true'] {
    border-color: ${theme.colors.blue900};
    background: ${theme.colors.blue300};
    color: ${theme.colors.gray900};
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  img {
    height: 14px;
    width: 14px;
    object-fit: contain;
  }
`;

let AddChip = styled(Chip)`
  padding: 0 6px;

  svg {
    height: 13px;
    width: 13px;
    color: ${theme.colors.gray600};
  }
`;

export let ChatMessageReactions = (p: {
  instanceId: string;
  chatId: string;
  channelId: string;
  message: ChatMessage;
}) => {
  let addReaction = useCreateChatMessageReaction();
  let removeReaction = useDeleteChatMessageReaction();

  let reactions = p.message.reactions ?? [];
  let isBusy = addReaction.isLoading || removeReaction.isLoading;

  let toggle = (shortcode: string, isMine: boolean) => {
    let base = {
      instanceId: p.instanceId,
      chatId: p.chatId,
      messageId: p.message.id,
      channelId: p.channelId
    };

    if (isMine) return removeReaction.mutate({ ...base, emoji: shortcode });

    return addReaction.mutate({ ...base, emoji: shortcode });
  };

  if (p.message.deletedAt) return null;

  return (
    <Wrapper>
      {reactions.map((reaction, index) => {
        let emoji = resolveEmoji(reaction.emoji);
        let shortcode = getEmojiShortcode(reaction.emoji);
        let isMine = (reaction.authors ?? []).some(author => author.isMe);
        let authorNames = (reaction.authors ?? []).map(
          author => author.fullName || author.userName
        );

        return (
          <Tooltip
            key={`${shortcode}-${index}`}
            content={
              authorNames.length
                ? `${authorNames.join(', ')} reacted with ${emoji.label}`
                : emoji.label
            }
          >
            <Chip
              type="button"
              data-mine={isMine}
              disabled={isBusy}
              onClick={() => toggle(shortcode, isMine)}
            >
              {emoji.imageUrl ? (
                <img src={emoji.imageUrl} alt={emoji.label} />
              ) : (
                <span>{emoji.character ?? emoji.label}</span>
              )}
              <span>{reaction.count}</span>
            </Chip>
          </Tooltip>
        );
      })}

      <Menu
        title="Add Reaction"
        items={quickReactions.map(reaction => ({
          id: reaction.shortcode,
          label: `${reaction.character}  :${reaction.shortcode}:`
        }))}
        onItemClick={shortcode => {
          let existing = reactions.find(
            reaction => getEmojiShortcode(reaction.emoji) == shortcode
          );
          toggle(
            shortcode,
            (existing?.authors ?? []).some(author => author.isMe)
          );
        }}
      >
        <AddChip type="button" aria-label="Add Reaction">
          <RiEmotionLine />
        </AddChip>
      </Menu>

      <addReaction.RenderError />
      <removeReaction.RenderError />
    </Wrapper>
  );
};
