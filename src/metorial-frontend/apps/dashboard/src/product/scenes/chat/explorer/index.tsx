import { Paths } from '@metorial/frontend-config';
import type { ChatChannelPreview, ChatPreview, ChatThreadPreview } from '@metorial/state';
import {
  useChat,
  useChatChannel,
  useChatThread,
  useChatThreads,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Text, theme } from '@metorial/ui';
import { RiArrowLeftLine, RiChat3Line } from '@remixicon/react';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { ChatChannelList } from './channelList';
import { ChatPicker } from './chatPicker';
import { ChatMessageList } from './messageList';

let THREAD_PAGE_SIZE = 50;

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${theme.colors.background};
`;

let TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  flex-shrink: 0;
`;

let TopBarSide = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let Title = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  svg {
    height: 15px;
    width: 15px;
    color: ${theme.colors.gray700};
    flex-shrink: 0;
  }

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

let Main = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

let Placeholder = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 40px 20px;
`;

export let ChatExplorerScene = () => {
  let navigate = useNavigate();
  let [search, setSearch] = useSearchParams();

  let instance = useCurrentInstance();
  let instanceId = instance.data?.id ?? null;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let chatId = search.get('chat_id');
  let channelId = search.get('channel_id');
  let threadId = search.get('thread_id');
  let chatConnectionId = search.get('chat_connection_id');
  let chatInstanceId = search.get('chat_instance_id');

  let chat = useChat(instanceId, chatId);
  let channel = useChatChannel(instanceId, chatId, channelId);
  let threads = useChatThreads(
    instanceId,
    chatId,
    channelId ? { channelId, order: 'desc', limit: THREAD_PAGE_SIZE } : null
  );

  let threadsById = useMemo(() => {
    let map = new Map<string, ChatThreadPreview>();
    for (let thread of threads.data?.items ?? []) map.set(thread.id, thread);
    return map;
  }, [threads.data?.items]);

  // A thread opened from a message may sit outside the loaded page of threads.
  let listedThread = threadId ? (threadsById.get(threadId) ?? null) : null;
  let fetchedThread = useChatThread(
    instanceId,
    chatId,
    listedThread ? null : threadId,
    channelId
  );
  let activeThread = listedThread ?? fetchedThread.data ?? null;

  let selectChat = useCallback(
    (chat: ChatPreview) =>
      setSearch(
        params => {
          params.set('chat_id', chat.id);
          params.delete('channel_id');
          params.delete('thread_id');
          return params;
        },
        { replace: true }
      ),
    [setSearch]
  );

  let selectChannel = useCallback(
    (channel: ChatChannelPreview) =>
      setSearch(
        params => {
          params.set('channel_id', channel.id);
          params.delete('thread_id');
          return params;
        },
        { replace: true }
      ),
    [setSearch]
  );

  let selectThread = useCallback(
    (threadId: string) =>
      setSearch(
        params => {
          params.set('thread_id', threadId);
          return params;
        },
        { replace: true }
      ),
    [setSearch]
  );

  let closeThread = useCallback(
    () =>
      setSearch(
        params => {
          params.delete('thread_id');
          return params;
        },
        { replace: true }
      ),
    [setSearch]
  );

  let changeChat = useCallback(
    () =>
      setSearch(
        params => {
          params.delete('chat_id');
          params.delete('channel_id');
          params.delete('thread_id');
          return params;
        },
        { replace: true }
      ),
    [setSearch]
  );

  let back = () => {
    // Return to whatever the explorer was opened for: a specific chat (or a channel/
    // thread within one) takes precedence over the connection/instance it belongs to.
    if (chatId) {
      navigate(Paths.instance.chat(organization.data, project.data, instance.data, chatId));
      return;
    }

    if (chatConnectionId) {
      navigate(
        Paths.instance.chatConnection(
          organization.data,
          project.data,
          instance.data,
          chatConnectionId
        )
      );
      return;
    }

    if (chatInstanceId) {
      navigate(
        Paths.instance.chatInstance(
          organization.data,
          project.data,
          instance.data,
          chatInstanceId
        )
      );
      return;
    }

    navigate(Paths.instance.chatConnections(organization.data, project.data, instance.data));
  };

  return (
    <Wrapper>
      <TopBar>
        <TopBarSide>
          <Button
            size="1"
            variant="outline"
            type="button"
            iconLeft={<RiArrowLeftLine size={13} />}
            onClick={back}
          >
            Back
          </Button>

          <Title>
            <RiChat3Line />
            <Text size="2" weight="medium" color="gray900">
              Chat Explorer
              {chat.data ? ` · ${chat.data.name}` : ''}
            </Text>
          </Title>
        </TopBarSide>
      </TopBar>

      <Body>
        {!chatId ? (
          <ChatPicker
            instanceId={instanceId}
            chatConnectionId={chatConnectionId}
            chatInstanceId={chatInstanceId}
            onSelectChat={selectChat}
          />
        ) : (
          <>
            <ChatChannelList
              instanceId={instanceId}
              chatId={chatId}
              chatName={chat.data?.name ?? null}
              channelId={channelId}
              threadId={threadId}
              threads={threads.data?.items ?? []}
              onSelectChannel={selectChannel}
              onSelectThread={selectThread}
              onChangeChat={changeChat}
            />

            <Main>
              {channelId ? (
                <ChatMessageList
                  instanceId={instanceId}
                  chatId={chatId}
                  channelId={channelId}
                  channel={channel.data ?? null}
                  thread={activeThread}
                  threadsById={threadsById}
                  onOpenThread={selectThread}
                  onCloseThread={closeThread}
                />
              ) : (
                <Placeholder>
                  <Text size="3" weight="medium" color="gray800">
                    Select a channel
                  </Text>
                  <Text size="2" color="gray600">
                    Pick a channel on the left to read its messages and post a new one.
                  </Text>
                </Placeholder>
              )}
            </Main>
          </>
        )}
      </Body>
    </Wrapper>
  );
};
