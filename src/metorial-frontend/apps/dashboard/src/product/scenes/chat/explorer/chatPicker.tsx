import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import type { ChatPreview } from '@metorial/state';
import {
  useChatConnections,
  useChats,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Input, Text, theme } from '@metorial/ui';
import { RiArrowRightLine, RiChat3Line } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { formatRelativeDate } from './shared';
import { ChatCardsSkeleton } from './skeletons';

let CHAT_PAGE_SIZE = 20;

let Wrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 48px 24px;
`;

let Inner = styled.div`
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: fit-content;
`;

let Chats = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let ChatCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: ${theme.colors.gray600};
    background: ${theme.colors.gray150};
  }
`;

let Icon = styled.div`
  height: 34px;
  width: 34px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray350};
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;

  svg {
    height: 16px;
    width: 16px;
    color: ${theme.colors.gray700};
  }
`;

let Copy = styled.div`
  flex: 1;
  min-width: 0;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let Chevron = styled.div`
  flex: none;
  color: ${theme.colors.gray600};
  display: flex;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let EmptyState = styled.div`
  border: 1px dashed ${theme.colors.gray400};
  border-radius: 10px;
  padding: 32px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

let ChatList = (p: {
  instanceId: string | null;
  search: string;
  chatConnectionId?: string | null;
  chatInstanceId?: string | null;
  connectionNames: Map<string, string>;
  emptyState: React.ReactNode;
  onSelectChat: (chat: ChatPreview) => void;
}) => {
  let chats = useChats(p.instanceId, {
    status: 'active',
    order: 'desc',
    limit: CHAT_PAGE_SIZE,
    ...(p.search ? { search: p.search } : {}),
    ...(p.chatConnectionId ? { chatConnectionId: p.chatConnectionId } : {}),
    ...(p.chatInstanceId ? { chatInstanceId: p.chatInstanceId } : {})
  });

  return renderWithPagination(chats, {
    loading: () => <ChatCardsSkeleton />,
    hidePaginationWhenUnavailable: true,
    emptyState: p.emptyState
  })(({ data }) => (
    <Chats>
      {data.items.map(chat => (
        <ChatCard key={chat.id} type="button" onClick={() => p.onSelectChat(chat)}>
          <Icon>
            <RiChat3Line />
          </Icon>

          <Copy>
            <Text size="2" weight="strong" color="gray900">
              {chat.name}
            </Text>
            <Text size="1" color="gray600">
              {p.connectionNames.get(chat.chatConnectionId) ?? 'Chat connection'} · Updated{' '}
              {formatRelativeDate(chat.updatedAt)}
            </Text>
          </Copy>

          <Chevron>
            <RiArrowRightLine />
          </Chevron>
        </ChatCard>
      ))}
    </Chats>
  ));
};

export let ChatPicker = (p: {
  instanceId: string | null;
  chatConnectionId?: string | null;
  chatInstanceId?: string | null;
  onSelectChat: (chat: ChatPreview) => void;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  let [search, setSearch] = useState('');
  let [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    let timeout = setTimeout(() => setAppliedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  let connections = useChatConnections(p.instanceId, { limit: 100 });

  let connectionNames = useMemo(() => {
    let names = new Map<string, string>();
    for (let connection of connections.data?.items ?? [])
      names.set(connection.id, connection.name);
    return names;
  }, [connections.data?.items]);

  return (
    <Wrapper>
      <Inner>
        <div>
          <Text size="5" weight="strong" color="gray900">
            Choose a Chat
          </Text>
          <Text size="2" color="gray600">
            Pick the connected chat you want to explore. You can browse its channels, read
            messages, and send new ones.
          </Text>
        </div>

        <Input
          label="Search chats"
          hideLabel
          size="2"
          value={search}
          placeholder="Search chats by name"
          onChange={event => setSearch(event.target.value)}
        />

        <ChatList
          key={appliedSearch}
          instanceId={p.instanceId}
          search={appliedSearch}
          chatConnectionId={p.chatConnectionId}
          chatInstanceId={p.chatInstanceId}
          connectionNames={connectionNames}
          onSelectChat={p.onSelectChat}
          emptyState={
            <EmptyState>
              <Text size="3" weight="medium" color="gray800">
                {appliedSearch ? 'No chats match your search' : 'No chats available'}
              </Text>
              <Text size="2" color="gray600">
                {appliedSearch
                  ? 'Try a different name.'
                  : 'Connect a chat provider and sync a workspace to start exploring.'}
              </Text>

              {!appliedSearch && (
                <Link
                  to={Paths.instance.chatConnections(
                    organization.data,
                    project.data,
                    instance.data
                  )}
                >
                  <Button size="2" variant="outline" as="span">
                    View Chat Connections
                  </Button>
                </Link>
              )}
            </EmptyState>
          }
        />
      </Inner>
    </Wrapper>
  );
};
