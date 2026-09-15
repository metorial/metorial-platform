import { renderWithLoader } from '@metorial/data-hooks';
import type {
  ChatChannelPreview,
  ChatMessage,
  ChatMessageCreateResult,
  ChatThreadPreview
} from '@metorial/state';
import { useChatMessages, useCreateChatMessageReaction } from '@metorial/state';
import { Badge, Button, Text, Tooltip, theme } from '@metorial/ui';
import {
  RiArrowLeftLine,
  RiDiscussLine,
  RiExternalLinkLine,
  RiRefreshLine
} from '@remixicon/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { ChatComposer } from './composer';
import { quickReactions } from './emoji';
import { ChatMessageBody } from './messageBody';
import { ChatMessageReactions } from './reactions';
import {
  AuthorAvatar,
  authorName,
  authorTypeLabels,
  channelName,
  channelPrefix,
  channelTypeLabels,
  formatDayLabel,
  formatRelativeDate,
  formatTime,
  isSameDay
} from './shared';
import { MessageListSkeleton, SkeletonBar, SkeletonText } from './skeletons';

let POLL_INTERVAL_MS = 5000;
let MESSAGE_PAGE_SIZE = 50;
let HOVER_REACTIONS = quickReactions.slice(0, 3);

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  flex: 1;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  flex-shrink: 0;
  min-height: 58px;
  background: ${theme.colors.background};
`;

let HeaderCopy = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let HeaderMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

let IconLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  width: 26px;
  border-radius: 6px;
  border: 1px solid ${theme.colors.gray400};
  color: ${theme.colors.gray700};

  &:hover {
    background: ${theme.colors.gray200};
  }

  svg {
    height: 14px;
    width: 14px;
  }
`;

let Scroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
  background: ${theme.colors.background};
`;

let PageNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
`;

let DayDivider = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px 8px;
  pointer-events: none;
`;

let DayLabel = styled.span`
  position: relative;
  padding: 2px 10px;
  border-radius: 11px;
  border: 1px solid ${theme.colors.gray350};
  background: ${theme.colors.background};
  font-size: 11px;
  font-weight: 500;
  color: ${theme.colors.gray700};
`;

let Row = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  padding: 5px 20px 5px 20px;
  position: relative;

  &:hover {
    background: ${theme.colors.gray150};
  }

  &[data-grouped='true'] {
    padding-top: 2px;
    padding-bottom: 2px;
  }
`;

let Gutter = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
`;

let GutterTime = styled.span`
  font-size: 10px;
  color: ${theme.colors.gray600};
  line-height: 20px;
  opacity: 0;

  ${Row}:hover & {
    opacity: 1;
  }
`;

let Content = styled.div`
  min-width: 0;
`;

let AuthorRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-bottom: 2px;
  flex-wrap: wrap;
`;

let Timestamp = styled.span`
  font-size: 11.5px;
  line-height: 16px;
  color: ${theme.colors.gray600};
`;

let HoverActions = styled.div`
  position: absolute;
  top: -12px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.1s ease;
  z-index: 3;

  ${Row}:hover & {
    opacity: 1;
    pointer-events: auto;
  }
`;

let HoverAction = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  min-width: 24px;
  padding: 0 4px;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  color: ${theme.colors.gray700};

  &:hover {
    background: ${theme.colors.gray250};
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  svg {
    height: 14px;
    width: 14px;
  }
`;

let ThreadLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
  padding: 4px 9px 4px 7px;
  border-radius: 7px;
  border: 1px solid ${theme.colors.gray350};
  background: ${theme.colors.background};
  cursor: pointer;
  font-size: 12.5px;
  line-height: 16px;

  &:hover {
    border-color: ${theme.colors.gray500};
    background: ${theme.colors.gray150};
  }

  svg {
    height: 13px;
    width: 13px;
    color: ${theme.colors.gray600};
  }
`;

let ThreadCount = styled.span`
  color: ${theme.colors.blue900};
  font-weight: 500;
`;

let ThreadTime = styled.span`
  color: ${theme.colors.gray600};
`;

let Empty = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 60px 20px;
`;

let ThreadBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray150};
  flex-shrink: 0;
  min-width: 0;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let shouldGroupWithPrevious = (message: ChatMessage, previous: ChatMessage | undefined) => {
  if (!previous) return false;
  if (previous.author?.id != message.author?.id) return false;
  if (!isSameDay(previous.sentAt, message.sentAt)) return false;

  return message.sentAt.getTime() - previous.sentAt.getTime() < 5 * 60 * 1000;
};

// Stands in for a just-sent message row until it shows up in a real fetch of the list —
// same grid/geometry as a real ungrouped MessageRow so nothing shifts once it's replaced.
let PendingMessageRow = () => (
  <Row>
    <Gutter>
      <SkeletonBar width={36} height={36} radius={7} />
    </Gutter>

    <Content>
      <AuthorRow>
        <SkeletonBar width={90} height={13} />
      </AuthorRow>

      <SkeletonBar width="42%" height={13} />
    </Content>
  </Row>
);

let MessageRow = (p: {
  instanceId: string;
  chatId: string;
  channelId: string;
  message: ChatMessage;
  grouped: boolean;
  thread: ChatThreadPreview | undefined;
  showThreadLink: boolean;
  onOpenThread?: (threadId: string) => void;
}) => {
  let author = p.message.author;
  let addReaction = useCreateChatMessageReaction();
  let isDeleted = !!p.message.deletedAt;

  return (
    <Row data-grouped={p.grouped}>
      {!isDeleted && (
        <HoverActions>
          {HOVER_REACTIONS.map(reaction => (
            <HoverAction
              key={reaction.shortcode}
              type="button"
              title={`React with :${reaction.shortcode}:`}
              disabled={addReaction.isLoading}
              onClick={() =>
                addReaction.mutate({
                  instanceId: p.instanceId,
                  chatId: p.chatId,
                  messageId: p.message.id,
                  channelId: p.channelId,
                  emoji: reaction.shortcode
                })
              }
            >
              {reaction.character}
            </HoverAction>
          ))}

          {p.message.threadId && p.onOpenThread && (
            <HoverAction
              type="button"
              title="Open thread"
              onClick={() => p.onOpenThread!(p.message.threadId!)}
            >
              <RiDiscussLine />
            </HoverAction>
          )}
        </HoverActions>
      )}

      <Gutter>
        {p.grouped ? (
          <GutterTime>{formatTime(p.message.sentAt)}</GutterTime>
        ) : (
          <AuthorAvatar author={author} size={36} />
        )}
      </Gutter>

      <Content>
        {!p.grouped && (
          <AuthorRow>
            <Text size="2" weight="strong" color="gray900">
              {authorName(author)}
            </Text>

            {author?.type && author.type != 'user' && (
              <Badge size="1" color="gray">
                {authorTypeLabels[author.type] ?? author.type}
              </Badge>
            )}
            {author?.isSelf && (
              <Badge size="1" color="blue">
                You
              </Badge>
            )}

            <Timestamp title={p.message.sentAt.toLocaleString()}>
              {formatTime(p.message.sentAt)}
            </Timestamp>

            {p.message.edited && <Timestamp>(edited)</Timestamp>}
          </AuthorRow>
        )}

        <ChatMessageBody message={p.message} />

        <ChatMessageReactions
          instanceId={p.instanceId}
          chatId={p.chatId}
          channelId={p.channelId}
          message={p.message}
          isApplying={addReaction.isLoading}
        />
        <addReaction.RenderError />

        {p.showThreadLink && p.message.threadId && p.onOpenThread && (
          <ThreadLink type="button" onClick={() => p.onOpenThread!(p.message.threadId!)}>
            <RiDiscussLine />
            <ThreadCount>
              {p.thread?.replyCount
                ? `${p.thread.replyCount} ${p.thread.replyCount == 1 ? 'reply' : 'replies'}`
                : 'View thread'}
            </ThreadCount>
            {p.thread?.lastReplyAt && (
              <ThreadTime>Last reply {formatRelativeDate(p.thread.lastReplyAt)}</ThreadTime>
            )}
          </ThreadLink>
        )}
      </Content>
    </Row>
  );
};

export let ChatMessageList = (p: {
  instanceId: string | null;
  chatId: string;
  channelId: string;
  channel: ChatChannelPreview | null;
  thread?: ChatThreadPreview | null;
  threadsById?: Map<string, ChatThreadPreview>;
  onOpenThread?: (threadId: string) => void;
  onCloseThread?: () => void;
}) => {
  let messages = useChatMessages(p.instanceId, p.chatId, {
    channelId: p.channelId,
    ...(p.thread ? { threadId: p.thread.id } : {}),
    order: 'desc',
    limit: MESSAGE_PAGE_SIZE
  });

  let scrollerRef = useRef<HTMLDivElement>(null);

  // The loader hands back a fresh refetch on every render, so the interval reads it
  // through a ref instead of restarting itself each time.
  let refetchRef = useRef(messages.refetch);
  refetchRef.current = messages.refetch;

  let refetch = useCallback(() => refetchRef.current(), []);

  useEffect(() => {
    let interval = setInterval(() => refetchRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // The API returns newest first so the latest page can be fetched without a cursor;
  // the transcript itself reads oldest to newest.
  let ordered = useMemo(
    () => [...(messages.data?.items ?? [])].reverse(),
    [messages.data?.items]
  );

  // Only the first message of a thread in this view gets the "open thread" affordance,
  // so a thread's replies don't each repeat the same link.
  let threadAnchorIds = useMemo(() => {
    let seenThreadIds = new Set<string>();
    let anchors = new Set<string>();

    for (let message of ordered) {
      if (!message.threadId || seenThreadIds.has(message.threadId)) continue;
      seenThreadIds.add(message.threadId);
      anchors.add(message.id);
    }

    return anchors;
  }, [ordered]);

  // A just-sent message renders as a skeleton row until the list's own fetch (kicked
  // off by the mutation and by polling) actually contains it.
  let [pendingMessageIds, setPendingMessageIds] = useState<string[]>([]);

  let handleMessageSent = useCallback((message: ChatMessageCreateResult) => {
    setPendingMessageIds(current =>
      current.includes(message.id) ? current : [...current, message.id]
    );
  }, []);

  let loadedMessageIds = useMemo(() => new Set(ordered.map(message => message.id)), [ordered]);

  let visiblePendingIds = pendingMessageIds.filter(id => !loadedMessageIds.has(id));

  useEffect(() => {
    setPendingMessageIds(current => {
      let next = current.filter(id => !loadedMessageIds.has(id));
      return next.length == current.length ? current : next;
    });
  }, [loadedMessageIds]);

  // Switching channel/thread makes any still-pending id meaningless for this view.
  useEffect(() => {
    setPendingMessageIds([]);
  }, [p.channelId, p.thread?.id]);

  let lastMessageId = ordered[ordered.length - 1]?.id;

  useLayoutEffect(() => {
    let scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.scrollTop = scroller.scrollHeight;
  }, [p.channelId, p.thread?.id, lastMessageId]);

  useLayoutEffect(() => {
    if (!visiblePendingIds.length) return;

    let scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.scrollTop = 0;
  }, [visiblePendingIds.length]);

  let hasPendingMessages = visiblePendingIds.length > 0;
  let today = new Date();

  let channelLabel = p.channel
    ? `${channelPrefix(p.channel)}${channelName(p.channel)}`
    : 'Channel';

  return (
    <Wrapper>
      <Header>
        <HeaderCopy>
          <HeaderTitle>
            {p.channel ? (
              <Text size="3" weight="strong" color="gray900">
                {channelLabel}
              </Text>
            ) : (
              <SkeletonText width={180} size="3" />
            )}

            {p.channel && (
              <Badge size="1" color="gray">
                {channelTypeLabels[p.channel.type] ?? p.channel.type}
              </Badge>
            )}
          </HeaderTitle>
        </HeaderCopy>

        <HeaderActions>
          {p.channel?.permalink && (
            <Tooltip content="Open in provider">
              <IconLink href={p.channel.permalink} target="_blank" rel="noreferrer">
                <RiExternalLinkLine />
              </IconLink>
            </Tooltip>
          )}

          <Button
            size="1"
            variant="outline"
            type="button"
            iconLeft={<RiRefreshLine size={13} />}
            onClick={refetch}
          >
            Refresh
          </Button>
        </HeaderActions>
      </Header>

      {p.thread && (
        <ThreadBar>
          <Button
            size="1"
            variant="outline"
            type="button"
            iconLeft={<RiArrowLeftLine size={13} />}
            onClick={() => p.onCloseThread?.()}
          >
            Back to Channel
          </Button>

          <Text size="2" weight="medium" color="gray900">
            {p.thread.subject ?? 'Thread'}
          </Text>

          {p.thread.replyCount != null && (
            <Text size="1" color="gray600">
              {p.thread.replyCount} {p.thread.replyCount == 1 ? 'reply' : 'replies'}
            </Text>
          )}
        </ThreadBar>
      )}

      <Scroller ref={scrollerRef}>
        {renderWithLoader(
          { messages },
          { loading: () => <MessageListSkeleton /> }
        )(({ messages: loaded }) => {
          // Messages can only resolve once the instance has, so this is just the type
          // narrowing the rows below need.
          let instanceId = p.instanceId;
          if (!instanceId) return <MessageListSkeleton />;

          if (!loaded.data.items.length && !visiblePendingIds.length) {
            return (
              <Empty>
                <Text size="3" weight="medium" color="gray800">
                  {p.thread ? 'No replies yet' : 'No messages yet'}
                </Text>
                <Text size="2" color="gray600">
                  {p.thread
                    ? 'Start the conversation by replying below.'
                    : `Send the first message in ${channelLabel}.`}
                </Text>
              </Empty>
            );
          }

          return (
            <>
              {hasPendingMessages && (
                <>
                  <DayDivider>
                    <DayLabel>Today</DayLabel>
                  </DayDivider>

                  {visiblePendingIds.map(id => (
                    <PendingMessageRow key={id} />
                  ))}
                </>
              )}

              {loaded.data.pagination.hasMoreAfter && (
                <PageNav>
                  <Button
                    size="1"
                    variant="outline"
                    type="button"
                    onClick={() => messages.next()}
                  >
                    Load Older Messages
                  </Button>
                </PageNav>
              )}

              {ordered.map((message, index) => {
                let previous = ordered[index - 1];
                let followsPendingTodayGroup =
                  !previous && hasPendingMessages && isSameDay(message.sentAt, today);
                let showDayDivider =
                  !followsPendingTodayGroup &&
                  (!previous || !isSameDay(previous.sentAt, message.sentAt));
                let thread = message.threadId
                  ? p.threadsById?.get(message.threadId)
                  : undefined;

                return (
                  <div key={message.id}>
                    {showDayDivider && (
                      <DayDivider>
                        <DayLabel>{formatDayLabel(message.sentAt)}</DayLabel>
                      </DayDivider>
                    )}

                    <MessageRow
                      instanceId={instanceId}
                      chatId={p.chatId}
                      channelId={p.channelId}
                      message={message}
                      grouped={!showDayDivider && shouldGroupWithPrevious(message, previous)}
                      thread={thread}
                      showThreadLink={threadAnchorIds.has(message.id)}
                      onOpenThread={p.thread ? undefined : p.onOpenThread}
                    />
                  </div>
                );
              })}

              {loaded.data.pagination.hasMoreBefore && (
                <PageNav>
                  <Button
                    size="1"
                    variant="outline"
                    type="button"
                    onClick={() => messages.previous()}
                  >
                    Jump to Newer Messages
                  </Button>
                </PageNav>
              )}
            </>
          );
        })}
      </Scroller>

      <ChatComposer
        instanceId={p.instanceId}
        chatId={p.chatId}
        channelId={p.channelId}
        threadId={p.thread?.id}
        placeholder={p.thread ? 'Reply in thread' : `Message ${channelLabel}`}
        onSent={message => {
          handleMessageSent(message);
          refetch();
        }}
      />
    </Wrapper>
  );
};
