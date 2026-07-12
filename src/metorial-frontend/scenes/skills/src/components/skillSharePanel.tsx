import {
  useCreatePortalConsumerAccess,
  useOrganizationMembers,
  usePortalConsumerAccess,
  usePortalConsumerGroups,
  usePortalConsumerProfiles,
  usePortals,
  useShareSkill,
  useSkillParticipants,
  useUser
} from '@metorial/state';
import {
  Avatar,
  Button,
  Input,
  Popover,
  Select,
  Spacer,
  Tabs,
  Text,
  theme
} from '@metorial/ui';
import { RiArrowLeftSLine, RiCheckLine } from '@remixicon/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import styled from 'styled-components';

export type SkillSharePanelMode = 'portal' | 'dashboard';

export type SkillSharePanelSkill = {
  id: string;
  name?: string | null;
};

export type SkillSharePanelContext = {
  mode: SkillSharePanelMode;
  portalId?: string | null;
  organizationId?: string | null;
  currentConsumerId?: string | null;
  skills: SkillSharePanelSkill[];
};

type AccountCandidate =
  | {
      type: 'consumer';
      id: string;
      name: string;
      email: string;
      imageUrl?: string | null;
    }
  | {
      type: 'member';
      id: string;
      actorId: string;
      name: string;
      email: string | null;
      imageUrl?: string | null;
    };

let PanelStack = styled.div`
  display: flex;
  flex-direction: column;
`;

let InviteRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

let ContentPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 500px;
  padding: 10px 20px 20px 20px;
`;

let RowList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 350px;
  overflow: auto;
  gap: 3px;
`;

let AccessRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 6px 0;
`;

let CandidateRow = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 6px 15px 6px 8px;
  border: 0;
  border-radius: 8px;
  background: ${p => (p.$selected ? theme.colors.blue200 : 'transparent')};
  color: ${theme.colors.foreground};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${p => (p.$selected ? theme.colors.blue300 : theme.colors.gray200)};
  }
`;

let PersonInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

let PersonName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let Truncate = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

let Muted = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray700};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

let Pill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: ${theme.colors.orange200};
  color: ${theme.colors.orange900};
  font-size: 11px;
  font-weight: 600;
`;

let AccessSelectWrap = styled.div`
  width: 132px;
  flex: 0 0 auto;
`;

let InvitePermissionFooter = styled.div`
  position: sticky;
  bottom: -20px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  padding: 10px 0 0 0;
  margin-top: auto;
  background: ${theme.colors.background};
`;

let InvitePermissionLabel = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: ${theme.colors.gray700};
`;

let EmptyState = styled.div``;

let inviteAccessItems = [
  { id: 'read', label: 'Can view' },
  { id: 'write', label: 'Full access' }
];

let accountAccessItems = [{ id: 'none', label: 'No access' }, ...inviteAccessItems];

let getSkillLabel = (skill: SkillSharePanelSkill) => skill.name || skill.id;

let getPortalItems = (
  portals:
    | {
        id: string;
        name: string;
      }[]
    | undefined
) => (portals ?? []).map(portal => ({ id: portal.id, label: portal.name }));

let getSkillItems = (skills: SkillSharePanelSkill[]) =>
  skills.map(skill => ({ id: skill.id, label: getSkillLabel(skill) }));

let getParticipantPermission = (roles: string[]): 'read' | 'write' =>
  roles.some(role => role == 'creator' || role == 'editor' || role == 'forker')
    ? 'write'
    : 'read';

let canParticipantWrite = (roles: string[]) =>
  roles.some(role => role == 'creator' || role == 'editor' || role == 'forker');

let filterBySearch = (value: string, search: string) =>
  value.toLowerCase().includes(search.trim().toLowerCase());

export let SkillSharePanelContent = (p: {
  instanceId: string | null | undefined;
  context: SkillSharePanelContext | null | undefined;
  onShared?: () => void | Promise<void>;
}) => {
  let skills = useMemo(
    () => (p.context?.skills ?? []).filter(skill => !!skill.id),
    [p.context?.skills]
  );
  let [selectedSkillId, setSelectedSkillId] = useState(skills[0]?.id ?? '');
  let [selectedPortalId, setSelectedPortalId] = useState(p.context?.portalId ?? '');
  let [search, setSearch] = useState('');
  let [isSearching, setIsSearching] = useState(false);
  let [selectedAccountKeys, setSelectedAccountKeys] = useState<Set<string>>(new Set());
  let [permission, setPermission] = useState<'read' | 'write'>('read');
  let [activeTab, setActiveTab] = useState<'accounts' | 'portal-groups'>('accounts');
  let [sharingGroupId, setSharingGroupId] = useState<string | null>(null);
  let [removingGroupId, setRemovingGroupId] = useState<string | null>(null);

  let mode = p.context?.mode ?? 'dashboard';
  let canManagePortalGroups = mode == 'dashboard';
  let portals = usePortals(mode == 'dashboard' ? p.instanceId : null, {
    limit: 100,
    order: 'asc'
  });
  let activePortalId = mode == 'portal' ? (p.context?.portalId ?? '') : selectedPortalId;
  let showPortalSelect = mode == 'dashboard' && (portals.data?.items?.length ?? 0) > 1;
  let participants = useSkillParticipants(p.instanceId, selectedSkillId, {
    limit: 100,
    order: 'asc'
  });
  let consumerProfiles = usePortalConsumerProfiles(p.instanceId, activePortalId, {
    limit: 100,
    order: 'asc',
    search: search.trim() || undefined
  });
  let organizationMembers = useOrganizationMembers(
    mode == 'dashboard' ? p.context?.organizationId : null
  );
  let consumerGroups = usePortalConsumerGroups(p.instanceId, activePortalId, {
    limit: 100,
    order: 'asc',
    search: search.trim() || undefined
  });
  let portalAccess = usePortalConsumerAccess(p.instanceId, activePortalId, {
    limit: 100,
    order: 'asc',
    skillId: selectedSkillId || undefined
  });
  let shareSkill = useShareSkill();
  let createPortalAccess = useCreatePortalConsumerAccess();
  let deletePortalAccess = portalAccess.deleteMutator();
  let currentUser = useUser();

  useEffect(() => {
    if (skills.some(skill => skill.id == selectedSkillId)) return;
    setSelectedSkillId(skills[0]?.id ?? '');
  }, [selectedSkillId, skills]);

  useEffect(() => {
    if (mode != 'portal') return;
    setSelectedPortalId(p.context?.portalId ?? '');
  }, [mode, p.context?.portalId]);

  useEffect(() => {
    if (mode != 'dashboard') return;
    if (selectedPortalId) return;

    let firstPortal = portals.data?.items?.[0];
    if (firstPortal) setSelectedPortalId(firstPortal.id);
  }, [mode, portals.data?.items, selectedPortalId]);

  useEffect(() => {
    setSelectedAccountKeys(new Set());
    setSearch('');
    setIsSearching(false);
    setSharingGroupId(null);
    setRemovingGroupId(null);
  }, [activePortalId, selectedSkillId]);

  useEffect(() => {
    if (canManagePortalGroups) return;
    setActiveTab('accounts');
  }, [canManagePortalGroups]);

  let selectedSkill = skills.find(skill => skill.id == selectedSkillId);
  let hasShareTarget =
    !!p.instanceId && !!selectedSkillId && (mode == 'dashboard' ? !!activePortalId : true);
  let selectedAccountCount = selectedAccountKeys.size;
  let currentUserEmail = currentUser.data?.email ?? null;
  let currentConsumerParticipant = useMemo(() => {
    if (mode != 'portal' || !p.context?.currentConsumerId) return null;
    return (
      (participants.data?.items ?? []).find(
        participant => participant.actor.consumer?.id == p.context?.currentConsumerId
      ) ?? null
    );
  }, [mode, p.context, participants.data?.items]);
  let canManageAccess =
    mode == 'dashboard' ||
    (!!currentConsumerParticipant && canParticipantWrite(currentConsumerParticipant.roles));

  let memberByActorId = useMemo(() => {
    let map = new Map<string, NonNullable<typeof organizationMembers.data>['items'][number]>();
    for (let member of organizationMembers.data?.items ?? []) {
      map.set(member.actorId, member);
    }
    return map;
  }, [organizationMembers.data?.items]);

  let profileByConsumerId = useMemo(() => {
    let map = new Map<string, NonNullable<typeof consumerProfiles.data>['items'][number]>();
    for (let profile of consumerProfiles.data?.items ?? []) {
      map.set(profile.consumerId, profile);
    }
    return map;
  }, [consumerProfiles.data?.items]);

  let participantAccountKeys = useMemo(() => {
    let set = new Set<string>();
    for (let participant of participants.data?.items ?? []) {
      let consumerProfile = participant.actor.consumer?.id
        ? profileByConsumerId.get(participant.actor.consumer.id)
        : null;
      if (consumerProfile) set.add(`consumer:${consumerProfile.id}`);
      let actorId = participant.actor.organizationActor?.id;
      let member = actorId ? memberByActorId.get(actorId) : null;
      if (member) set.add(`member:${member.id}`);
    }
    return set;
  }, [memberByActorId, participants.data?.items, profileByConsumerId]);

  let accountCandidates = useMemo<AccountCandidate[]>(() => {
    let candidates: AccountCandidate[] = [];

    for (let profile of consumerProfiles.data?.items ?? []) {
      if (profile.consumerId == p.context?.currentConsumerId) continue;
      let key = `consumer:${profile.id}`;
      if (participantAccountKeys.has(key)) continue;
      candidates.push({
        type: 'consumer',
        id: profile.id,
        name: profile.name || profile.email,
        email: profile.email,
        imageUrl: profile.imageUrl
      });
    }

    if (mode == 'dashboard') {
      for (let member of organizationMembers.data?.items ?? []) {
        if (currentUserEmail && member.actor.email == currentUserEmail) continue;
        let key = `member:${member.id}`;
        if (participantAccountKeys.has(key)) continue;
        candidates.push({
          type: 'member',
          id: member.id,
          actorId: member.actorId,
          name: member.actor.name,
          email: member.actor.email,
          imageUrl: member.actor.imageUrl
        });
      }
    }

    if (!search.trim()) return candidates;

    return candidates.filter(candidate =>
      filterBySearch(`${candidate.name} ${candidate.email ?? ''}`, search)
    );
  }, [
    consumerProfiles.data?.items,
    currentUserEmail,
    mode,
    organizationMembers.data?.items,
    p.context?.currentConsumerId,
    participantAccountKeys,
    search
  ]);

  let toggleAccount = (candidate: AccountCandidate) => {
    let key = `${candidate.type}:${candidate.id}`;
    setSelectedAccountKeys(current => {
      let next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  let stopInviteSearch = () => {
    setSearch('');
    setIsSearching(false);
    setSelectedAccountKeys(new Set());
  };

  useEffect(() => {
    if (canManageAccess) return;
    setSearch('');
    setIsSearching(false);
    setSelectedAccountKeys(new Set());
  }, [canManageAccess]);

  let shareWithAccounts = async () => {
    if (!p.instanceId || !selectedSkillId || selectedAccountKeys.size == 0) return;

    let consumerProfileIds: string[] = [];
    let organizationMemberIds: string[] = [];

    for (let key of selectedAccountKeys) {
      let [type, id] = key.split(':');
      if (type == 'consumer' && id) {
        let profile = consumerProfiles.data?.items?.find(profile => profile.id == id);
        if (profile?.consumerId != p.context?.currentConsumerId) consumerProfileIds.push(id);
      }
      if (type == 'member' && id && mode == 'dashboard') {
        let member = organizationMembers.data?.items?.find(member => member.id == id);
        if (!currentUserEmail || member?.actor.email != currentUserEmail) {
          organizationMemberIds.push(id);
        }
      }
    }

    if (!consumerProfileIds.length && !organizationMemberIds.length) return;

    let [shared] = await shareSkill.mutate({
      instanceId: p.instanceId,
      skillId: selectedSkillId,
      consumerProfileIds,
      organizationMemberIds,
      permission
    });

    if (!shared) return;

    setSelectedAccountKeys(new Set());
    setSearch('');
    setIsSearching(false);
    await participants.refetch();
    await p.onShared?.();
  };

  let updateAccountAccess = async (
    participant: NonNullable<typeof participants.data>['items'][number],
    nextPermission: 'none' | 'read' | 'write'
  ) => {
    if (!p.instanceId || !selectedSkillId) return;

    let consumerProfileId = participant.actor.consumer?.id
      ? profileByConsumerId.get(participant.actor.consumer.id)?.id
      : null;
    let actorId = participant.actor.organizationActor?.id;
    let isCurrentConsumer =
      !!participant.actor.consumer?.id &&
      participant.actor.consumer.id == p.context?.currentConsumerId;
    let isCurrentOrganizationMember =
      mode == 'dashboard' &&
      !!currentUserEmail &&
      participant.actor.organizationActor?.email == currentUserEmail;
    if (isCurrentConsumer || isCurrentOrganizationMember) return;
    if (mode != 'dashboard' && actorId) return;
    let memberId = mode == 'dashboard' && actorId ? memberByActorId.get(actorId)?.id : null;
    if (!consumerProfileId && !memberId) return;

    let [shared] = await shareSkill.mutate({
      instanceId: p.instanceId,
      skillId: selectedSkillId,
      consumerProfileIds: consumerProfileId ? [consumerProfileId] : [],
      organizationMemberIds: memberId ? [memberId] : [],
      permission: nextPermission
    });

    if (!shared) return;
    await participants.refetch();
    await p.onShared?.();
  };

  let shareWithGroup = async (consumerGroupId: string) => {
    if (!p.instanceId || !selectedSkillId || !activePortalId) return;

    setSharingGroupId(consumerGroupId);
    try {
      let [created] = await createPortalAccess.mutate({
        instanceId: p.instanceId,
        portalId: activePortalId,
        consumerGroupId,
        name: selectedSkill ? getSkillLabel(selectedSkill) : undefined,
        access: {
          type: 'skill',
          skillId: selectedSkillId
        }
      });

      if (!created) return;

      await portalAccess.refetch();
      await p.onShared?.();
    } finally {
      setSharingGroupId(null);
    }
  };

  let removeGroupAccess = async (consumerAccessId: string) => {
    if (!p.instanceId || !activePortalId) return;

    setRemovingGroupId(consumerAccessId);
    try {
      let [deleted] = await deletePortalAccess.mutate({ consumerAccessId });
      if (!deleted) return;
      await portalAccess.refetch();
      await p.onShared?.();
    } finally {
      setRemovingGroupId(null);
    }
  };

  if (!p.context || skills.length == 0) {
    return (
      <EmptyState>
        <Text size="2" color="gray600">
          This document is not linked to a shareable skill.
        </Text>
      </EmptyState>
    );
  }

  return (
    <PanelStack>
      {skills.length > 1 && (
        <div style={{ padding: 10 }}>
          <Select
            label="Skill"
            size="2"
            value={selectedSkillId}
            items={getSkillItems(skills)}
            onChange={setSelectedSkillId}
          />
        </div>
      )}

      {showPortalSelect && (
        <div style={{ padding: 10 }}>
          <Select
            label="Portal"
            size="2"
            value={selectedPortalId}
            placeholder="Select a portal"
            items={getPortalItems(portals.data?.items)}
            onChange={setSelectedPortalId}
          />
        </div>
      )}

      {canManagePortalGroups ? (
        <div>
          <Tabs
            current={activeTab}
            tabs={[
              { id: 'accounts', label: 'Accounts' },
              { id: 'portal-groups', label: 'Portal Groups' }
            ]}
            action={id => {
              if (id == 'accounts' || id == 'portal-groups') {
                setActiveTab(id);
                setSearch('');
                setIsSearching(false);
              }
            }}
            margin={{ bottom: 8, top: 8 }}
            padding={{ left: 20, right: 20 }}
          />
        </div>
      ) : (
        <Spacer height={8} />
      )}

      {!hasShareTarget ? (
        <EmptyState>
          <Text size="2" color="gray600">
            Select a portal before sharing this skill.
          </Text>
        </EmptyState>
      ) : (
        <>
          {activeTab == 'accounts' && (
            <ContentPanel>
              {canManageAccess ? (
                <InviteRow>
                  {isSearching && (
                    <Button
                      size="2"
                      variant="soft"
                      iconRight={<RiArrowLeftSLine size={16} />}
                      onClick={stopInviteSearch}
                    />
                  )}
                  <Input
                    label="Invite accounts"
                    hideLabel
                    size="2"
                    style={{ flex: 1 }}
                    placeholder="Email or group, separated by commas"
                    value={search}
                    onFocus={() => setIsSearching(true)}
                    onInput={value => {
                      setSearch(value);
                      setIsSearching(true);
                    }}
                  />
                  <Button
                    size="2"
                    loading={shareSkill.isLoading}
                    disabled={isSearching && selectedAccountCount == 0}
                    onClick={() => {
                      if (!isSearching) {
                        setIsSearching(true);
                        return;
                      }
                      shareWithAccounts();
                    }}
                  >
                    Invite
                  </Button>
                </InviteRow>
              ) : null}

              {isSearching ? (
                <>
                  <RowList>
                    {accountCandidates.map(candidate => {
                      let key = `${candidate.type}:${candidate.id}`;
                      let selected = selectedAccountKeys.has(key);
                      return (
                        <CandidateRow
                          key={key}
                          type="button"
                          $selected={selected}
                          onClick={() => toggleAccount(candidate)}
                        >
                          <Avatar
                            entity={{
                              name: candidate.name,
                              imageUrl: candidate.imageUrl ?? undefined
                            }}
                            size={36}
                          />
                          <PersonInfo>
                            <PersonName>
                              <Truncate>{candidate.name}</Truncate>
                              {candidate.type == 'member' && <Pill>Member</Pill>}
                            </PersonName>
                            <Muted>{candidate.email}</Muted>
                          </PersonInfo>
                          {/* <Text size="1" color={selected ? 'blue800' : 'gray600'}>
                            {selected ? 'Selected' : 'Select'}
                          </Text> */}

                          <div>{selected ? <RiCheckLine size={16} /> : null}</div>
                        </CandidateRow>
                      );
                    })}
                    {!consumerProfiles.isLoading &&
                      !organizationMembers.isLoading &&
                      accountCandidates.length == 0 && (
                        <EmptyState>
                          <Text size="2" color="gray600">
                            No invite candidates found.
                          </Text>
                        </EmptyState>
                      )}
                  </RowList>
                  <InvitePermissionFooter>
                    <InvitePermissionLabel>
                      Invite people to work on this skill
                    </InvitePermissionLabel>
                    <AccessSelectWrap>
                      <Select
                        label="Permission"
                        hideLabel
                        size="2"
                        value={permission}
                        items={inviteAccessItems}
                        onChange={value => {
                          if (value == 'read' || value == 'write') setPermission(value);
                        }}
                      />
                    </AccessSelectWrap>
                  </InvitePermissionFooter>
                </>
              ) : (
                <>
                  <RowList>
                    {(participants.data?.items ?? []).map(participant => {
                      let participantPermission = getParticipantPermission(participant.roles);
                      let isCreator = participant.roles.includes('creator');
                      let consumerProfileId = participant.actor.consumer?.id
                        ? profileByConsumerId.get(participant.actor.consumer.id)?.id
                        : null;
                      let actorId = participant.actor.organizationActor?.id;
                      let isOrganizationMember = !!actorId;
                      let isCurrentConsumer =
                        !!participant.actor.consumer?.id &&
                        participant.actor.consumer.id == p.context?.currentConsumerId;
                      let isCurrentOrganizationMember =
                        mode == 'dashboard' &&
                        !!currentUserEmail &&
                        participant.actor.organizationActor?.email == currentUserEmail;
                      let isSelf = isCurrentConsumer || isCurrentOrganizationMember;
                      let memberId =
                        mode == 'dashboard' && actorId
                          ? memberByActorId.get(actorId)?.id
                          : null;
                      let canChangeAccess =
                        !!consumerProfileId || (mode == 'dashboard' && !!memberId);
                      return (
                        <AccessRow key={participant.id}>
                          <Avatar
                            entity={{
                              name: participant.actor.name,
                              imageUrl: participant.actor.imageUrl ?? undefined
                            }}
                            size={40}
                          />
                          <PersonInfo>
                            <PersonName>
                              <Truncate>{participant.actor.name}</Truncate>
                              {isCreator && <Pill>Owner</Pill>}
                            </PersonName>
                            <Muted>{participant.actor.email}</Muted>
                          </PersonInfo>
                          <AccessSelectWrap>
                            <Select
                              label="Access"
                              hideLabel
                              size="2"
                              disabled={
                                !canManageAccess ||
                                isCreator ||
                                isSelf ||
                                !canChangeAccess ||
                                (mode == 'portal' && isOrganizationMember)
                              }
                              value={participantPermission}
                              items={accountAccessItems}
                              onChange={value => {
                                if (value == 'none' || value == 'read' || value == 'write') {
                                  updateAccountAccess(participant, value);
                                }
                              }}
                            />
                          </AccessSelectWrap>
                        </AccessRow>
                      );
                    })}
                    {!participants.isLoading &&
                      (participants.data?.items ?? []).length == 0 && (
                        <EmptyState>
                          <Text size="2" color="gray600">
                            No accounts have access yet.
                          </Text>
                        </EmptyState>
                      )}
                  </RowList>
                </>
              )}
            </ContentPanel>
          )}

          {activeTab == 'portal-groups' && canManagePortalGroups && (
            <ContentPanel>
              <Input
                label="Search portal groups"
                hideLabel
                size="2"
                placeholder="Search portal groups..."
                value={search}
                onInput={setSearch}
              />
              <RowList>
                {(consumerGroups.data?.items ?? []).map(group => {
                  let existingAccess = (portalAccess.data?.items ?? []).find(
                    access => access.consumerGroup.id == group.id
                  );
                  return (
                    <AccessRow key={group.id}>
                      <Avatar
                        entity={{
                          name: group.name,
                          imageUrl: `https://avatar.metorial-cdn.com/${group.id}`
                        }}
                        size={40}
                      />
                      <PersonInfo>
                        <PersonName>
                          <Truncate>{group.name}</Truncate>
                          {group.isDefault && <Pill>Default</Pill>}
                        </PersonName>
                        <Muted>{group.description || 'Portal group'}</Muted>
                      </PersonInfo>
                      <AccessSelectWrap>
                        <Select
                          label="Access"
                          hideLabel
                          size="2"
                          value={existingAccess ? 'read' : 'none'}
                          items={[
                            { id: 'none', label: 'No access' },
                            { id: 'read', label: 'Can view' }
                          ]}
                          disabled={
                            sharingGroupId == group.id ||
                            (!!existingAccess && removingGroupId == existingAccess.id)
                          }
                          onChange={value => {
                            if (value == 'read' && !existingAccess) shareWithGroup(group.id);
                            if (value == 'none' && existingAccess) {
                              removeGroupAccess(existingAccess.id);
                            }
                          }}
                        />
                      </AccessSelectWrap>
                    </AccessRow>
                  );
                })}
                {!consumerGroups.isLoading &&
                  (consumerGroups.data?.items ?? []).length == 0 && (
                    <EmptyState>
                      <Text size="2" color="gray600">
                        No portal groups found.
                      </Text>
                    </EmptyState>
                  )}
              </RowList>
            </ContentPanel>
          )}

          <div>
            <shareSkill.RenderError />
            <createPortalAccess.RenderError />
            <deletePortalAccess.RenderError />
          </div>
        </>
      )}
    </PanelStack>
  );
};

let SkillSharePopoverContent = styled.div`
  width: 450px;
  cursor: default;
`;

export let SkillSharePopover = (p: {
  trigger: ReactNode;
  instanceId: string | null | undefined;
  context: SkillSharePanelContext | null | undefined;
  onShared?: () => void | Promise<void>;
}) => (
  <Popover
    trigger={p.trigger}
    side="bottom"
    align="end"
    sideOffset={8}
    operationKey={p.context?.skills.map(skill => skill.id).join(':')}
    onOpenAutoFocus={event => event.preventDefault()}
  >
    <Popover.Content
      style={{
        padding: 0,
        background: 'white',
        borderRadius: 9
      }}
    >
      <SkillSharePopoverContent>
        <SkillSharePanelContent
          instanceId={p.instanceId}
          context={p.context}
          onShared={p.onShared}
        />
      </SkillSharePopoverContent>
    </Popover.Content>
  </Popover>
);
