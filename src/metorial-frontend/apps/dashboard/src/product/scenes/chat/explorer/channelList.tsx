import { renderWithLoader } from '@metorial/data-hooks';
import type { ChatChannelPreview, ChatThreadPreview } from '@metorial/state';
import { useChatChannels } from '@metorial/state';
import { Button, Input, Text, theme } from '@metorial/ui';
import { RiDiscussLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { channelName, channelPrefix, channelTypeLabels, formatRelativeDate } from './shared';
import { ChannelListSkeleton, SkeletonText } from './skeletons';

let CHANNEL_PAGE_SIZE = 100;

let Wrapper = styled.aside`
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray150};
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

let Header = styled.div`
  padding: 12px 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;

  & > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let Scroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 8px 20px;
`;

let SectionLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px;
`;

let Item = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  padding: 5px 8px;
  border-radius: 6px;
  color: ${theme.colors.gray800};
  font-size: 14px;
  line-height: 20px;

  &:hover {
    background: ${theme.colors.gray300};
  }

  &[data-active='true'] {
    background: ${theme.colors.gray800};
    color: ${theme.colors.background};
  }

  svg {
    height: 14px;
    width: 14px;
    flex-shrink: 0;
  }
`;

let Prefix = styled.span`
  color: ${theme.colors.gray600};
  flex-shrink: 0;

  ${Item}[data-active='true'] & {
    color: ${theme.colors.gray400};
  }
`;

let Label = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Meta = styled.span`
  font-size: 11px;
  color: ${theme.colors.gray600};
  flex-shrink: 0;

  ${Item}[data-active='true'] & {
    color: ${theme.colors.gray400};
  }
`;

let EmptyNote = styled.div`
  padding: 10px 8px;
`;

export let ChatChannelList = (p: {
  instanceId: string | null;
  chatId: string;
  chatName: string | null;
  channelId: string | null;
  threadId: string | null;
  threads: ChatThreadPreview[];
  onSelectChannel: (channel: ChatChannelPreview) => void;
  onSelectThread: (threadId: string) => void;
  onChangeChat: () => void;
}) => {
  let [search, setSearch] = useState('');
  let [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    let timeout = setTimeout(() => setAppliedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  let channels = useChatChannels(p.instanceId, p.chatId, {
    order: 'asc',
    limit: CHANNEL_PAGE_SIZE,
    ...(appliedSearch ? { search: appliedSearch } : {})
  });

  let items = channels.data?.items ?? [];

  return (
    <Wrapper>
      <Header>
        <HeaderTop>
          <div>
            {p.chatName ? (
              <Text size="2" weight="strong" color="gray900">
                {p.chatName}
              </Text>
            ) : (
              <SkeletonText width={120} size="2" />
            )}

            {channels.data ? (
              <Text size="1" color="gray600">
                {appliedSearch
                  ? `${items.length} matching`
                  : `${items.length}${channels.data.pagination.hasMoreAfter ? '+' : ''} channels`}
              </Text>
            ) : (
              <SkeletonText width={70} size="1" />
            )}
          </div>

          <Button size="1" variant="outline" type="button" onClick={p.onChangeChat}>
            Change
          </Button>
        </HeaderTop>

        <Input
          label="Search channels"
          hideLabel
          size="1"
          value={search}
          placeholder="Search channels"
          onChange={event => setSearch(event.target.value)}
        />
      </Header>

      <Scroller>
        {renderWithLoader(
          { channels },
          { loading: () => <ChannelListSkeleton /> }
        )(() => (
          <>
            <SectionLabel>
              <Text size="1" weight="medium" color="gray600" transform="uppercase">
                Channels
              </Text>
            </SectionLabel>

            {items.map(channel => (
              <Item
                key={channel.id}
                type="button"
                data-active={channel.id == p.channelId}
                onClick={() => p.onSelectChannel(channel)}
              >
                <Prefix>{channelPrefix(channel)}</Prefix>
                <Label>{channelName(channel)}</Label>
                <Meta>{formatRelativeDate(channel.lastInteractionAt) ?? ''}</Meta>
              </Item>
            ))}

            {items.length == 0 && (
              <EmptyNote>
                <Text size="2" color="gray600">
                  {appliedSearch
                    ? 'No channels match your search.'
                    : 'No channels have been synced for this chat yet.'}
                </Text>
              </EmptyNote>
            )}

            {p.threads.length > 0 && (
              <>
                <SectionLabel style={{ paddingTop: 16 }}>
                  <Text size="1" weight="medium" color="gray600" transform="uppercase">
                    Threads
                  </Text>
                </SectionLabel>

                {p.threads.map(thread => (
                  <Item
                    key={thread.id}
                    type="button"
                    data-active={thread.id == p.threadId}
                    onClick={() => p.onSelectThread(thread.id)}
                  >
                    <RiDiscussLine />
                    <Label>
                      {thread.subject ?? channelTypeLabels[thread.type] ?? 'Thread'}
                    </Label>
                    {thread.replyCount != null && <Meta>{thread.replyCount}</Meta>}
                  </Item>
                ))}
              </>
            )}
          </>
        ))}
      </Scroller>
    </Wrapper>
  );
};
