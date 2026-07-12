import {
  useAllProviderListings,
  useAllSkillItems,
  useSkillAgents,
  useSkillMergeRequests,
  useSkillParticipants,
  type SkillItem
} from '@metorial/state';
import { Avatar, Button, Input, Menu, Popover, Text, theme, Tooltip } from '@metorial/ui';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiFileTextLine,
  RiFolderLine,
  RiGitPullRequestLine,
  RiGroupLine,
  RiHistoryLine,
  RiRobot2Line,
  RiSettings3Line,
  RiToolsLine
} from '@remixicon/react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { SkillSharePopover, type SkillSharePanelContext } from '../components/skillSharePanel';
import { showSkillAgentFormModal } from './skillAgents';
import { showSkillItemPickerPanel, type SkillItemPickerKind } from './skillLinkProviders';
import { SkillStoreFileTree } from './skillStoreFileViewer';

export type SkillWorkspaceRoutes = {
  overview: string;
  mergeRequests: string;
  mergeRequest: (mergeRequestId: string) => string;
  document: (documentId: string, itemId: string) => string;
  agent: (documentId: string) => string;
  providers: string;
  agents: string;
  settings: string;
  groups: string;
  versions: string;
  participants: string;
};

export type SkillWorkspaceLayoutProps = {
  instanceId: string | null | undefined;
  skill: {
    id: string;
    name: string;
    storeId: string | null | undefined;
    visibility?: string | null;
  };
  routes: SkillWorkspaceRoutes;
  children: ReactNode;
  workspaceLabel?: string | null;
  backPath?: string | null;
  actions?: ReactNode;
  shareContext?: SkillSharePanelContext | null;
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  allowProviders?: boolean;
  readOnly?: boolean;
  onNameChange?: (name: string) => Promise<void>;
};

let Shell = styled.div`
  display: grid;
  grid-template-rows: 57px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let TopNav = styled.header`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 0 18px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
`;

let Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 100%;
`;

let BackLink = styled(Link)<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-right: 2px;
  border-radius: 6px;
  color: ${theme.colors.gray700};

  &:hover {
    color: ${theme.colors.foreground};
    background: ${p => (p.$active ? theme.colors.gray400 : theme.colors.gray300)};
  }
`;

let CrumbSeparator = styled.span`
  color: ${theme.colors.gray600};
`;

let SkillName = styled.span`
  max-width: 280px;
  overflow: hidden;
  color: ${theme.colors.foreground};
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let SkillNameTrigger = styled.button`
  display: inline-flex;
  min-width: 0;
  padding: 5px 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray300};
  }

  &:disabled {
    cursor: default;
  }
`;

let SkillNamePopover = styled.div`
  width: 300px;
`;

let Visibility = styled.span`
  color: ${theme.colors.gray700};
  font-size: 12px;
`;

let NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-left: auto;
  height: 100%;
`;

let HostActions = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

let ParticipantTrigger = styled.button`
  all: unset;
  cursor: pointer;
`;

let AvatarStack = styled.div`
  display: flex;
  align-items: center;
  padding-left: 6px;

  > * {
    margin-left: -6px;
    border: 2px solid ${theme.colors.gray100};
    border-radius: 999px;
  }
`;

let ParticipantOverflow = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: -6px;
  border: 2px solid ${theme.colors.gray100};
  border-radius: 999px;
  background: ${theme.colors.gray400};
  color: ${theme.colors.gray900};
  font-size: 10px;
  font-weight: 600;
`;

let Workspace = styled.div`
  display: grid;
  grid-template-columns: 276px minmax(0, 1fr);
  min-height: 0;
`;

let Sidebar = styled.aside`
  min-height: 0;
  overflow-y: auto;
  padding: 11px 9px 28px;
  border-right: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
`;

let SidebarSection = styled.section`
  margin-bottom: 15px;
`;

let SectionHeader = styled.div`
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.055em;
`;

let SectionAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${theme.colors.gray900};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

let SidebarLink = styled(Link)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  color: ${theme.colors.gray900};
  background: ${p => (p.$active ? theme.colors.gray300 : 'transparent')};
  font-size: 13px;
  text-decoration: none;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    color: ${theme.colors.foreground};
    background: ${p => (p.$active ? theme.colors.gray400 : theme.colors.gray300)};
    text-decoration: none;
  }

  &:active {
    background: ${theme.colors.gray300};
    text-decoration: none;
  }

  &:hover:active {
    background: ${theme.colors.gray400};
    text-decoration: none;
  }

  &:focus-visible {
    background: ${theme.colors.gray300};
    text-decoration: none;
  }

  &:hover:focus-visible {
    background: ${theme.colors.gray400};
  }

  svg {
    flex: 0 0 auto;
    color: inherit;
  }
`;

let LinkLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let LinkCount = styled.span`
  margin-left: auto;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 500;
`;

let ChildLinks = styled.div`
  margin: 2px 0 3px 18px;
  padding-left: 7px;
  border-left: 1px solid ${theme.colors.gray400};
`;

let ChildLink = styled(Link)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  overflow: hidden;
  color: ${theme.colors.gray900};
  background: ${p => (p.$active ? theme.colors.gray300 : 'transparent')};
  font-size: 13px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    color: ${theme.colors.foreground};
    background: ${p => (p.$active ? theme.colors.gray400 : theme.colors.gray300)};
    text-decoration: none;
  }

  &:active {
    background: ${theme.colors.gray300};
    text-decoration: none;
  }

  &:hover:active {
    background: ${theme.colors.gray400};
    text-decoration: none;
  }

  &:focus-visible {
    background: ${theme.colors.gray300};
    text-decoration: none;
  }

  &:hover:focus-visible {
    background: ${theme.colors.gray400};
  }
`;

let ItemMark = styled.span<{ $color?: string }>`
  width: 8px;
  height: 8px;
  margin: 0 4px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: ${p => p.$color ?? theme.colors.green600};
`;

let Main = styled.main`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: ${theme.colors.background};
`;

let isRouteActive = (pathname: string, route: string, exact = false) => {
  let routePath = route.split(/[?#]/)[0]?.replace(/\/+$/, '') || '/';
  let currentPath = pathname.replace(/\/+$/, '') || '/';
  return exact
    ? currentPath == routePath
    : currentPath == routePath || currentPath.startsWith(`${routePath}/`);
};

let getLinkedItemName = (item: SkillItem) => {
  if (item.type == 'provider' && item.provider) {
    return item.provider.name ?? item.provider.slug;
  }
  if (item.integration) return item.integration.name ?? item.integration.slug;
  return item.id;
};

let EditableSkillName = (p: {
  name: string;
  readOnly?: boolean;
  onNameChange?: (name: string) => Promise<void>;
}) => {
  let [draftName, setDraftName] = useState(p.name);
  let [isSaving, setIsSaving] = useState(false);
  let isSavingRef = useRef(false);
  let canEdit = !p.readOnly && !!p.onNameChange;

  useEffect(() => {
    setDraftName(p.name);
  }, [p.name]);

  let save = async () => {
    let name = draftName.trim();
    if (!name || name == p.name || !p.onNameChange || isSavingRef.current) {
      if (!name) setDraftName(p.name);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await p.onNameChange(name);
    } catch {
      setDraftName(p.name);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Popover
      trigger={
        <SkillNameTrigger
          aria-label={canEdit ? 'Rename skill' : undefined}
          disabled={!canEdit}
          title={p.name}
          type="button"
        >
          <SkillName>{p.name}</SkillName>
        </SkillNameTrigger>
      }
      operationKey={p.name}
      side="bottom"
      align="start"
      sideOffset={7}
      onOpenAutoFocus={event => event.preventDefault()}
    >
      <Popover.Content>
        <SkillNamePopover>
          <Input
            autoFocus
            disabled={isSaving}
            label="Name"
            value={draftName}
            onBlur={() => void save()}
            onInput={setDraftName}
            onKeyDown={event => {
              if (event.key == 'Enter') {
                event.preventDefault();
                void save();
              }
            }}
          />
        </SkillNamePopover>
      </Popover.Content>
    </Popover>
  );
};

export let SkillWorkspaceLayout = (p: SkillWorkspaceLayoutProps) => {
  let location = useLocation();
  let navigate = useNavigate();
  let [selectedProviderItemId, setSelectedProviderItemId] = useState<string | null>(null);
  let skillItems = useAllSkillItems(p.instanceId, p.skill.id, {
    order: 'asc',
    status: ['active']
  });
  let skillAgents = useSkillAgents(p.instanceId, p.skill.id, { order: 'asc' });
  let participants = useSkillParticipants(p.instanceId, p.skill.id, {
    order: 'asc',
    limit: 100
  });
  let outgoingMergeRequests = useSkillMergeRequests(p.instanceId, {
    sourceSkillId: p.skill.id,
    status: 'open',
    order: 'desc'
  });
  let incomingMergeRequests = useSkillMergeRequests(p.instanceId, {
    targetSkillId: p.skill.id,
    status: 'open',
    order: 'desc'
  });

  let linkedProviderIds = (skillItems.data ?? []).flatMap(item =>
    item.type == 'provider' && item.provider ? [item.provider.id] : []
  );
  let providerListings = useAllProviderListings(p.instanceId, linkedProviderIds);
  let linkedIntegrationIds = (skillItems.data ?? []).flatMap(item =>
    item.type == 'integration' && item.integration ? [item.integration.id] : []
  );
  let openMergeRequests = [
    ...(outgoingMergeRequests.data?.items ?? []),
    ...(incomingMergeRequests.data?.items ?? [])
  ].filter((request, index, all) => all.findIndex(item => item.id == request.id) == index);
  let participantItems = participants.data?.items ?? [];
  let linkedItems = skillItems.data ?? [];
  let activeProviderItemId = linkedItems.some(item => item.id == selectedProviderItemId)
    ? selectedProviderItemId
    : linkedItems[0]?.id;

  let addProvider = (kind: SkillItemPickerKind) => {
    if (!p.instanceId || p.readOnly) return;

    showSkillItemPickerPanel({
      kind,
      instanceId: p.instanceId,
      skillId: p.skill.id,
      excludeProviderIds: linkedProviderIds,
      excludeIntegrationIds: linkedIntegrationIds,
      allowedProviderIds: p.allowedProviderIds,
      allowedIntegrationIds: p.allowedIntegrationIds,
      onComplete: () => skillItems.refetch()
    });
  };

  let addAgent = () => {
    if (!p.instanceId || p.readOnly) return;

    showSkillAgentFormModal({
      mode: 'create',
      instanceId: p.instanceId,
      skillId: p.skill.id,
      onComplete: () => skillAgents.refetch()
    });
  };

  return (
    <Shell>
      <TopNav>
        <Breadcrumbs>
          {p.backPath ? (
            <BackLink aria-label="Back" to={p.backPath}>
              <RiArrowLeftLine size={17} />
            </BackLink>
          ) : null}
          {p.workspaceLabel ? (
            <>
              {p.backPath ? (
                <Link to={p.backPath}>
                  <Text size="2" color="gray700">
                    {p.workspaceLabel}
                  </Text>
                </Link>
              ) : (
                <Text size="2" color="gray700">
                  {p.workspaceLabel}
                </Text>
              )}

              <CrumbSeparator>/</CrumbSeparator>
            </>
          ) : null}
          <EditableSkillName
            name={p.skill.name}
            readOnly={p.readOnly}
            onNameChange={p.onNameChange}
          />
          {p.skill.visibility ? <Visibility>{p.skill.visibility}</Visibility> : null}
        </Breadcrumbs>

        <NavActions>
          {p.actions ? <HostActions>{p.actions}</HostActions> : null}
          <Tooltip content="Skill settings">
            <Button
              aria-label="Skill settings"
              iconRight={<RiSettings3Line size={17} />}
              onClick={() => navigate(p.routes.settings)}
              size="2"
              variant="soft"
            />
          </Tooltip>
          {p.shareContext && !p.readOnly ? (
            <>
              <SkillSharePopover
                instanceId={p.instanceId}
                context={p.shareContext}
                onShared={() => participants.refetch()}
                trigger={
                  <Button size="2" variant="soft">
                    Share
                  </Button>
                }
              />
              <SkillSharePopover
                instanceId={p.instanceId}
                context={p.shareContext}
                onShared={() => participants.refetch()}
                trigger={
                  <ParticipantTrigger aria-label="Manage participants" type="button">
                    <AvatarStack>
                      {participantItems.slice(0, 3).map(participant => (
                        <Avatar
                          key={participant.id}
                          entity={{
                            name: participant.actor.name,
                            imageUrl: participant.actor.imageUrl ?? undefined
                          }}
                          size={36}
                          noTooltip
                        />
                      ))}
                      {participantItems.length > 3 ? (
                        <ParticipantOverflow>
                          +{participantItems.length - 3}
                        </ParticipantOverflow>
                      ) : null}
                    </AvatarStack>
                  </ParticipantTrigger>
                }
              />
            </>
          ) : null}
        </NavActions>
      </TopNav>

      <Workspace>
        <Sidebar>
          <SidebarSection>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.overview, true)}
              to={p.routes.overview}
            >
              <RiFileTextLine size={16} />
              <LinkLabel>Overview</LinkLabel>
              <LinkCount>SKILL.md</LinkCount>
            </SidebarLink>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.mergeRequests, true)}
              to={p.routes.mergeRequests}
            >
              <RiGitPullRequestLine size={16} />
              <LinkLabel>Merge requests</LinkLabel>
              {openMergeRequests.length ? (
                <LinkCount>{openMergeRequests.length}</LinkCount>
              ) : null}
            </SidebarLink>
            {openMergeRequests.length ? (
              <ChildLinks>
                {openMergeRequests.map(request => {
                  let href = p.routes.mergeRequest(request.id);
                  return (
                    <ChildLink
                      $active={isRouteActive(location.pathname, href, true)}
                      key={request.id}
                      to={href}
                    >
                      {request.title}
                    </ChildLink>
                  );
                })}
              </ChildLinks>
            ) : null}
          </SidebarSection>

          <SidebarSection>
            <SectionHeader>Files</SectionHeader>
            <SkillStoreFileTree
              instanceId={p.instanceId}
              storeId={p.skill.storeId}
              getDocumentPath={p.routes.document}
              shareContext={p.shareContext}
              readOnly={p.readOnly}
            />
          </SidebarSection>

          <SidebarSection>
            <SectionHeader>
              Providers
              {!p.readOnly ? (
                p.allowProviders === false ? (
                  <SectionAction
                    aria-label="Add integration"
                    disabled={!p.instanceId}
                    onClick={() => addProvider('integration')}
                    type="button"
                  >
                    <RiAddLine size={12} strokeWidth={2.4} />
                  </SectionAction>
                ) : (
                  <Menu
                    items={[
                      { id: 'provider', label: 'Provider' },
                      { id: 'integration', label: 'Integration' }
                    ]}
                    onItemClick={item => {
                      if (item == 'provider' || item == 'integration') addProvider(item);
                    }}
                  >
                    <SectionAction
                      aria-label="Add provider"
                      disabled={!p.instanceId}
                      type="button"
                    >
                      <RiAddLine size={12} strokeWidth={2.4} />
                    </SectionAction>
                  </Menu>
                )
              ) : null}
            </SectionHeader>
            {linkedItems.length ? (
              linkedItems.map(item => (
                <SidebarLink
                  $active={
                    isRouteActive(location.pathname, p.routes.providers, true) &&
                    item.id == activeProviderItemId
                  }
                  key={item.id}
                  onClick={() => setSelectedProviderItemId(item.id)}
                  to={p.routes.providers}
                >
                  {item.type == 'provider' && item.provider ? (
                    <Avatar
                      entity={{
                        name: item.provider.name ?? item.provider.slug,
                        photoUrl: providerListings.data?.find(
                          listing => listing.provider.id == item.provider?.id
                        )?.imageUrl
                      }}
                      size={16}
                      radius={4}
                      noTooltip
                      imageFit="contain"
                    />
                  ) : (
                    <RiToolsLine size={16} />
                  )}
                  <LinkLabel>{getLinkedItemName(item)}</LinkLabel>
                </SidebarLink>
              ))
            ) : (
              <SidebarLink
                $active={isRouteActive(location.pathname, p.routes.providers, true)}
                to={p.routes.providers}
              >
                <RiToolsLine size={16} />
                <LinkLabel>Linked providers</LinkLabel>
              </SidebarLink>
            )}
          </SidebarSection>

          <SidebarSection>
            <SectionHeader>
              Agents
              {!p.readOnly ? (
                <SectionAction
                  aria-label="Add agent"
                  disabled={!p.instanceId}
                  onClick={addAgent}
                  type="button"
                >
                  <RiAddLine size={12} strokeWidth={2.4} />
                </SectionAction>
              ) : null}
            </SectionHeader>
            {(skillAgents.data?.items ?? []).length ? (
              (skillAgents.data?.items ?? []).map(agent => (
                <SidebarLink
                  $active={isRouteActive(
                    location.pathname,
                    p.routes.agent(agent.documentId),
                    true
                  )}
                  key={agent.id}
                  to={p.routes.agent(agent.documentId)}
                >
                  <ItemMark />
                  <LinkLabel>{agent.name}</LinkLabel>
                </SidebarLink>
              ))
            ) : (
              <SidebarLink
                $active={isRouteActive(location.pathname, p.routes.agents, true)}
                to={p.routes.agents}
              >
                <RiRobot2Line size={16} />
                <LinkLabel>Skill agents</LinkLabel>
              </SidebarLink>
            )}
          </SidebarSection>

          <SidebarSection>
            <SectionHeader>Manage</SectionHeader>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.settings, true)}
              to={p.routes.settings}
            >
              <RiSettings3Line size={16} />
              <LinkLabel>Settings</LinkLabel>
            </SidebarLink>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.groups, true)}
              to={p.routes.groups}
            >
              <RiFolderLine size={16} />
              <LinkLabel>Groups</LinkLabel>
            </SidebarLink>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.versions, true)}
              to={p.routes.versions}
            >
              <RiHistoryLine size={16} />
              <LinkLabel>Versions</LinkLabel>
            </SidebarLink>
            <SidebarLink
              $active={isRouteActive(location.pathname, p.routes.participants, true)}
              to={p.routes.participants}
            >
              <RiGroupLine size={16} />
              <LinkLabel>Participants</LinkLabel>
              {participantItems.length ? (
                <LinkCount>{participantItems.length}</LinkCount>
              ) : null}
            </SidebarLink>
          </SidebarSection>
        </Sidebar>

        <Main>{p.children}</Main>
      </Workspace>
    </Shell>
  );
};
