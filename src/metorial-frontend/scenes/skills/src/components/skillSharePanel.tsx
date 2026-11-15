import {
  useAllPortalConsumerAccess,
  useCreatePortalConsumerAccess,
  usePortalConsumerAccess,
  usePortalConsumerGroups,
  usePortalConsumerProfiles,
  usePortals,
  useShareSkill,
  useSkill,
  useSkillAccess,
  useSkillParticipants,
  useStorePermissions,
  useUser
} from '@metorial/state';
import {
  Avatar,
  Button,
  Input,
  Menu,
  Popover,
  Select,
  Switch,
  Text,
  theme
} from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiGroupLine,
  RiLayoutTopLine
} from '@remixicon/react';
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

type ShareCandidate =
  | {
      type: 'consumer';
      id: string;
      name: string;
      description: string;
      imageUrl?: string | null;
      isOrganizationMember: boolean;
    }
  | {
      type: 'group';
      id: string;
      name: string;
      description: string;
      imageUrl?: string | null;
    };

let PanelStack = styled.div`
  display: flex;
  flex-direction: column;
`;

let PanelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 0 16px;
`;

let PanelTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

let PortalChip = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px 0 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 999px;
  background: ${theme.colors.background};
  color: ${theme.colors.gray800};
  font-size: 12px;
  cursor: pointer;
  flex: 0 0 auto;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let IconAvatar = styled.div<{ $size: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: 9px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  flex: 0 0 auto;
`;

let SelfPortalFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let SelfPortalText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

let SelfPortalTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let AccessSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  border-top: 1px solid ${theme.colors.gray300};
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
  padding: 12px 16px;
`;

let RowList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 350px;
  overflow: auto;
  gap: 2px;
`;

let AccessRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0;
`;

let CandidateRow = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 4px 8px;
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

let GroupPill = styled(Pill)`
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
`;

let AccessSelectWrap = styled.div`
  width: 180px;
  flex: 0 0 auto;
`;

let InvitePermissionFooter = styled.div`
  position: sticky;
  bottom: -12px;
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

let EmptyState = styled.div`
  padding: 4px 0 8px 0;
`;

type InvitePermission = 'read' | 'write' | 'manage' | 'owner';

type AccountPermission = 'none' | Exclude<InvitePermission, 'manage'>;

let inviteAccessItems = [
  { id: 'read', label: 'Can view' },
  { id: 'write', label: 'Can edit' }
];

let ownerAccessItem = { id: 'owner', label: 'Owner' };

let manageAccessItem = { id: 'manage', label: 'Can edit and share' };

let accountAccessItems = [{ id: 'none', label: 'Remove' }, ...inviteAccessItems];

type GroupPermission = 'read' | 'write' | 'manage';

let groupLevelItems = [...inviteAccessItems, manageAccessItem];

let groupAccessItems = [{ id: 'none', label: 'Remove' }, ...groupLevelItems];

let isGroupPermission = (value: string): value is GroupPermission =>
  value == 'read' || value == 'write' || value == 'manage';

let groupPermissionOf = (permission: InvitePermission): GroupPermission =>
  permission == 'owner' ? 'manage' : permission;

let isInvitePermission = (value: string): value is InvitePermission =>
  isGroupPermission(value) || value == 'owner';

let isAccountPermission = (value: string): value is AccountPermission =>
  value == 'none' || value == 'read' || value == 'write' || value == 'owner';

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

let isParticipantOwner = (roles: string[]) => roles.includes('owner');

let getParticipantPermission = (roles: string[]): InvitePermission =>
  isParticipantOwner(roles)
    ? 'owner'
    : roles.some(role => role == 'creator' || role == 'editor')
      ? 'write'
      : 'read';

let hasParticipantAccess = (roles: string[]) =>
  roles.some(role => role == 'owner' || role == 'editor' || role == 'viewer');

let isListedParticipant = (participant: { roles: string[] }) =>
  hasParticipantAccess(participant.roles);

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
  let [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  let [permission, setPermission] = useState<InvitePermission>('read');
  let [removingGroupId, setRemovingGroupId] = useState<string | null>(null);

  let mode = p.context?.mode ?? 'dashboard';
  let canManagePortalGroups = mode == 'dashboard';
  let portals = usePortals(mode == 'dashboard' ? p.instanceId : null, {
    limit: 100,
    order: 'asc'
  });
  let activePortalId = mode == 'portal' ? (p.context?.portalId ?? '') : selectedPortalId;
  let portalItems = portals.data?.items ?? [];
  let activePortal = portalItems.find(portal => portal.id == activePortalId);
  let showPortalChip = mode == 'dashboard' && portalItems.length > 1;
  let participants = useSkillParticipants(p.instanceId, selectedSkillId, {
    limit: 100,
    order: 'asc'
  });
  let currentUser = useUser();
  let currentUserEmail = currentUser.data?.email ?? null;
  let ownProfiles = usePortalConsumerProfiles(
    mode == 'dashboard' ? p.instanceId : null,
    activePortalId,
    currentUserEmail ? { limit: 10, search: currentUserEmail } : null
  );
  let ownProfile =
    mode == 'dashboard'
      ? (ownProfiles.data?.items ?? []).find(
          profile => !!profile.userId && profile.userId == currentUser.data?.id
        )
      : undefined;
  let accessibleParticipants = useMemo(
    () =>
      (participants.data?.items ?? [])
        .filter(isListedParticipant)
        .filter(
          participant => !ownProfile || participant.actor.consumer?.id != ownProfile.consumerId
        )
        .sort(
          (a, b) => Number(isParticipantOwner(b.roles)) - Number(isParticipantOwner(a.roles))
        ),
    [participants.data?.items, ownProfile?.consumerId]
  );
  let consumerProfiles = usePortalConsumerProfiles(p.instanceId, activePortalId, {
    limit: 100,
    order: 'asc',
    search: search.trim() || undefined
  });
  let consumerGroups = usePortalConsumerGroups(
    canManagePortalGroups ? p.instanceId : null,
    activePortalId,
    {
      limit: 100,
      order: 'asc',
      search: search.trim() || undefined
    }
  );
  let portalAccess = usePortalConsumerAccess(p.instanceId, activePortalId, {
    limit: 100,
    order: 'asc',
    skillId: selectedSkillId || undefined
  });
  let shareSkill = useShareSkill();
  let createPortalAccess = useCreatePortalConsumerAccess();
  let deletePortalAccess = portalAccess.deleteMutator();
  let updatePortalAccess = portalAccess.updateMutator();
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
    setSelectedKeys(new Set());
    setSearch('');
    setIsSearching(false);
    setRemovingGroupId(null);
  }, [activePortalId, selectedSkillId]);

  let selectedSkill = skills.find(skill => skill.id == selectedSkillId);
  let hasShareTarget =
    !!p.instanceId && !!selectedSkillId && (mode == 'dashboard' ? !!activePortalId : true);
  let currentConsumerParticipant = useMemo(() => {
    if (mode != 'portal' || !p.context?.currentConsumerId) return null;
    return (
      accessibleParticipants.find(
        participant => participant.actor.consumer?.id == p.context?.currentConsumerId
      ) ?? null
    );
  }, [accessibleParticipants, mode, p.context]);
  let portalSkill = useSkill(mode == 'portal' ? p.instanceId : null, selectedSkillId);
  let portalStorePermissions = useStorePermissions(
    mode == 'portal' ? p.instanceId : null,
    portalSkill.data?.storeId
  );
  let isCurrentConsumerOwner =
    !!currentConsumerParticipant && isParticipantOwner(currentConsumerParticipant.roles);
  let canManageAccess =
    mode == 'dashboard' ||
    !!portalStorePermissions.data?.canManageAccess ||
    isCurrentConsumerOwner;
  let canAssignOwners = mode == 'dashboard' || isCurrentConsumerOwner;

  let skillAccess = useSkillAccess(p.instanceId, selectedSkillId, canManageAccess);
  let inheritedSkillGroupIds = useMemo(
    () => [
      ...new Set(
        (skillAccess.data?.grants ?? [])
          .map(grant => grant.source.skillGroup?.id)
          .filter((id): id is string => !!id)
      )
    ],
    [skillAccess.data?.grants]
  );
  let inheritedPortalAccess = useAllPortalConsumerAccess(
    canManagePortalGroups ? p.instanceId : null,
    activePortalId,
    inheritedSkillGroupIds.length ? { skillGroupId: inheritedSkillGroupIds } : null
  );
  let grantedPermissionByProfileId = useMemo(() => {
    let map = new Map<string, 'read' | 'write'>();
    for (let grant of skillAccess.data?.grants ?? []) {
      let profileId = grant.subject.consumerProfileId;
      if (grant.source.type != 'direct') continue;
      if (grant.subject.type != 'consumer_profile' || !profileId) continue;
      if (grant.level == 'read' && map.has(profileId)) continue;
      map.set(profileId, grant.level == 'read' ? 'read' : 'write');
    }
    return map;
  }, [skillAccess.data?.grants]);

  let profileByConsumerId = useMemo(() => {
    let map = new Map<string, NonNullable<typeof consumerProfiles.data>['items'][number]>();
    for (let profile of consumerProfiles.data?.items ?? []) {
      map.set(profile.consumerId, profile);
    }
    return map;
  }, [consumerProfiles.data?.items]);

  let everyoneGroup = canManagePortalGroups
    ? (consumerGroups.data?.items ?? []).find(group => group.isDefault)
    : undefined;
  let allGroupAccesses = portalAccess.data?.items ?? [];
  let everyoneAccess = everyoneGroup
    ? allGroupAccesses.find(access => access.consumerGroup.id == everyoneGroup.id)
    : undefined;
  let groupAccesses = allGroupAccesses.filter(access => !access.consumerGroup.isDefault);
  let inheritedGroupAccesses = inheritedSkillGroupIds.length
    ? (inheritedPortalAccess.data ?? []).filter(access => access.access.type == 'skill_group')
    : [];

  let listedConsumerIds = useMemo(
    () =>
      new Set(
        accessibleParticipants
          .flatMap(participant => [participant.actor.consumer?.id, participant.consumerId])
          .filter((id): id is string => !!id)
      ),
    [accessibleParticipants]
  );

  let candidates = useMemo<ShareCandidate[]>(() => {
    let result: ShareCandidate[] = [];

    for (let profile of consumerProfiles.data?.items ?? []) {
      if (mode == 'dashboard' && !!profile.userId && profile.userId == currentUser.data?.id) {
        continue;
      }
      if (profile.consumerId == p.context?.currentConsumerId) continue;
      if (listedConsumerIds.has(profile.consumerId)) continue;
      result.push({
        type: 'consumer',
        id: profile.id,
        name: profile.name || profile.email,
        description: profile.email,
        imageUrl: profile.imageUrl,
        isOrganizationMember: !!profile.organizationMember
      });
    }

    for (let group of consumerGroups.data?.items ?? []) {
      if (group.isDefault) continue;
      if (groupAccesses.some(access => access.consumerGroup.id == group.id)) continue;
      result.push({
        type: 'group',
        id: group.id,
        name: group.name,
        description: group.description || 'Access Group',
        imageUrl: `https://avatar.metorial-cdn.com/${group.id}`
      });
    }

    if (!search.trim()) return result;

    return result.filter(candidate =>
      filterBySearch(`${candidate.name} ${candidate.description}`, search)
    );
  }, [
    consumerGroups.data?.items,
    consumerProfiles.data?.items,
    currentUser.data?.id,
    groupAccesses,
    listedConsumerIds,
    mode,
    p.context?.currentConsumerId,
    search
  ]);

  let selectedCandidates = candidates.filter(candidate =>
    selectedKeys.has(`${candidate.type}:${candidate.id}`)
  );
  let selectedHasConsumer = selectedCandidates.some(candidate => candidate.type == 'consumer');
  let selectedHasGroup = selectedCandidates.some(candidate => candidate.type == 'group');
  let invitePermissionItems = [
    ...inviteAccessItems,
    ...(canManagePortalGroups && !selectedHasConsumer ? [manageAccessItem] : []),
    ...(canAssignOwners && (!selectedHasGroup || selectedHasConsumer) ? [ownerAccessItem] : [])
  ];

  let toggleCandidate = (candidate: ShareCandidate) => {
    let key = `${candidate.type}:${candidate.id}`;
    setSelectedKeys(current => {
      let next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  let stopInviteSearch = () => {
    setSearch('');
    setIsSearching(false);
    setSelectedKeys(new Set());
  };

  useEffect(() => {
    if (
      (permission == 'owner' &&
        (!canAssignOwners || (selectedHasGroup && !selectedHasConsumer))) ||
      (permission == 'manage' && (!canManagePortalGroups || selectedHasConsumer))
    ) {
      setPermission('read');
    }
  }, [
    canAssignOwners,
    canManagePortalGroups,
    permission,
    selectedHasConsumer,
    selectedHasGroup
  ]);

  useEffect(() => {
    if (canManageAccess) return;
    stopInviteSearch();
  }, [canManageAccess]);

  let refetchAccess = async () => {
    await Promise.all([participants.refetch(), skillAccess.refetch(), portalAccess.refetch()]);
    await p.onShared?.();
  };

  let addGroupAccess = async (consumerGroupId: string, level: GroupPermission) => {
    if (!p.instanceId || !selectedSkillId) return false;

    let [created] = await createPortalAccess.mutate({
      instanceId: p.instanceId,
      portalId: activePortalId,
      consumerGroupId,
      name: selectedSkill ? getSkillLabel(selectedSkill) : undefined,
      access: {
        type: 'skill',
        skillId: selectedSkillId,
        permission: level
      }
    });

    return !!created;
  };

  let updateGroupAccess = async (consumerAccessId: string, level: GroupPermission) => {
    let [updated] = await updatePortalAccess.mutate({ consumerAccessId, permission: level });
    if (!updated) return;

    await refetchAccess();
  };

  let setEveryoneAccess = async (value: string) => {
    if (!everyoneGroup) return;

    if (value == 'none') {
      if (everyoneAccess) await removeGroupAccess(everyoneAccess.id);
      return;
    }

    if (!isGroupPermission(value)) return;

    if (everyoneAccess) {
      await updateGroupAccess(everyoneAccess.id, value);
      return;
    }

    if (!(await addGroupAccess(everyoneGroup.id, value))) return;
    await refetchAccess();
  };

  let shareWithSelected = async () => {
    if (!p.instanceId || !selectedSkillId || selectedKeys.size == 0) return;

    let consumerProfileIds: string[] = [];
    let organizationMemberProfileIds: string[] = [];
    let consumerGroupIds: string[] = [];

    for (let candidate of candidates) {
      if (!selectedKeys.has(`${candidate.type}:${candidate.id}`)) continue;

      if (candidate.type == 'group') {
        if (canManagePortalGroups) consumerGroupIds.push(candidate.id);
      } else if (candidate.isOrganizationMember) {
        organizationMemberProfileIds.push(candidate.id);
      } else {
        consumerProfileIds.push(candidate.id);
      }
    }

    if (
      permission == 'manage' &&
      (consumerProfileIds.length || organizationMemberProfileIds.length)
    ) {
      return;
    }

    for (let [profileIds, profilePermission] of [
      [consumerProfileIds, permission == 'manage' ? null : permission],
      [organizationMemberProfileIds, 'read']
    ] as const) {
      if (!profileIds.length || !profilePermission) continue;

      let [shared] = await shareSkill.mutate({
        instanceId: p.instanceId,
        skillId: selectedSkillId,
        consumerProfileIds: [...profileIds],
        organizationMemberIds: [],
        permission: profilePermission
      });

      if (!shared) return;
    }

    for (let consumerGroupId of consumerGroupIds) {
      if (!(await addGroupAccess(consumerGroupId, groupPermissionOf(permission)))) return;
    }

    stopInviteSearch();
    await refetchAccess();
  };

  let updateAccountAccess = async (
    participant: NonNullable<typeof participants.data>['items'][number],
    nextPermission: AccountPermission
  ) => {
    if (!p.instanceId || !selectedSkillId) return;

    let consumerProfileId = participant.actor.consumer?.id
      ? profileByConsumerId.get(participant.actor.consumer.id)?.id
      : null;
    let isCurrentConsumer =
      !!participant.actor.consumer?.id &&
      participant.actor.consumer.id == p.context?.currentConsumerId;
    if (!consumerProfileId || isCurrentConsumer) return;
    if (mode != 'dashboard' && participant.actor.organizationActor?.id) return;

    let [shared] = await shareSkill.mutate({
      instanceId: p.instanceId,
      skillId: selectedSkillId,
      consumerProfileIds: [consumerProfileId],
      organizationMemberIds: [],
      permission: nextPermission
    });

    if (!shared) return;
    await refetchAccess();
  };

  let removeGroupAccess = async (consumerAccessId: string) => {
    if (!p.instanceId || !activePortalId) return;

    setRemovingGroupId(consumerAccessId);
    try {
      let [deleted] = await deletePortalAccess.mutate({ consumerAccessId });
      if (!deleted) return;
      await refetchAccess();
    } finally {
      setRemovingGroupId(null);
    }
  };

  let ownGroupAccess = ownProfile
    ? groupAccesses.find(access =>
        (ownProfile.groups ?? []).some(
          assignment => assignment.group.id == access.consumerGroup.id
        )
      )
    : undefined;
  let ownGrantedDirectly = !!ownProfile && grantedPermissionByProfileId.has(ownProfile.id);
  let portalName = activePortal?.name ?? 'portal';

  let toggleOwnPortalAccess = async (visible: boolean) => {
    if (!p.instanceId || !selectedSkillId || !ownProfile) return;

    let [shared] = await shareSkill.mutate({
      instanceId: p.instanceId,
      skillId: selectedSkillId,
      consumerProfileIds: [ownProfile.id],
      organizationMemberIds: [],
      permission: visible ? 'read' : 'none'
    });

    if (!shared) return;
    await refetchAccess();
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

  let selectedCount = selectedKeys.size;
  let selectedHasViewOnly = selectedCandidates.some(
    candidate => candidate.type == 'consumer' && candidate.isOrganizationMember
  );
  let isSharing = shareSkill.isLoading || createPortalAccess.isLoading;

  return (
    <PanelStack>
      <PanelHeader>
        <PanelTitle>
          <Text size="2" weight="strong">
            Share Skill
          </Text>
        </PanelTitle>

        {showPortalChip && (
          <Menu
            title="Share within portal"
            label="Change portal"
            items={portalItems.map(portal => ({
              id: portal.id,
              label: portal.name,
              icon: portal.id == activePortalId ? <RiCheckLine size={14} /> : <span />
            }))}
            onItemClick={setSelectedPortalId}
          >
            <PortalChip type="button">
              <RiLayoutTopLine size={14} />
              <span>{activePortal?.name ?? 'Select a portal'}</span>
              <RiArrowDownSLine size={14} />
            </PortalChip>
          </Menu>
        )}
      </PanelHeader>

      {!hasShareTarget ? (
        <EmptyState>
          <Text size="2" color="gray600">
            Select a portal before sharing this skill.
          </Text>
        </EmptyState>
      ) : (
        <>
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
                  label="Add people or access groups"
                  hideLabel
                  size="2"
                  style={{ flex: 1 }}
                  placeholder={
                    canManagePortalGroups ? 'Add people or access groups' : 'Add people'
                  }
                  value={search}
                  onFocus={() => setIsSearching(true)}
                  onInput={value => {
                    setSearch(value);
                    setIsSearching(true);
                  }}
                />
              </InviteRow>
            ) : null}

            {isSearching ? (
              <>
                <RowList>
                  {candidates.map(candidate => {
                    let key = `${candidate.type}:${candidate.id}`;
                    let selected = selectedKeys.has(key);
                    return (
                      <CandidateRow
                        key={key}
                        type="button"
                        $selected={selected}
                        onClick={() => toggleCandidate(candidate)}
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
                            {candidate.type == 'group' && <GroupPill>Access Group</GroupPill>}
                          </PersonName>
                          <Muted>{candidate.description}</Muted>
                        </PersonInfo>
                        <div>{selected ? <RiCheckLine size={16} /> : null}</div>
                      </CandidateRow>
                    );
                  })}
                  {!consumerProfiles.isLoading &&
                    !consumerGroups.isLoading &&
                    candidates.length == 0 && (
                      <EmptyState>
                        <Text size="2" color="gray600">
                          No one left to add.
                        </Text>
                      </EmptyState>
                    )}
                </RowList>

                <InvitePermissionFooter>
                  <InvitePermissionLabel>
                    {selectedCount
                      ? `${selectedCount} selected`
                      : 'Pick people or access groups'}
                    {selectedHasViewOnly && permission != 'read'
                      ? ' · organization members already can edit and share'
                      : ''}
                    {selectedHasGroup && permission == 'owner'
                      ? ' · groups can edit and share but not own'
                      : ''}
                  </InvitePermissionLabel>
                  <AccessSelectWrap>
                    <Select
                      label="Access for new people"
                      hideLabel
                      size="2"
                      value={permission}
                      items={invitePermissionItems}
                      onChange={value => {
                        if (isInvitePermission(value)) setPermission(value);
                      }}
                    />
                  </AccessSelectWrap>
                  <Button
                    size="2"
                    loading={isSharing}
                    disabled={selectedCount == 0}
                    onClick={shareWithSelected}
                  >
                    Add
                  </Button>
                </InvitePermissionFooter>
              </>
            ) : (
              <>
                <RowList>
                  {accessibleParticipants.map(participant => {
                    let isOwner = isParticipantOwner(participant.roles);
                    let consumerProfileId = participant.actor.consumer?.id
                      ? profileByConsumerId.get(participant.actor.consumer.id)?.id
                      : null;
                    let isOrganizationMember = !!participant.actor.organizationActor?.id;
                    let isCurrentConsumer =
                      !!participant.actor.consumer?.id &&
                      participant.actor.consumer.id == p.context?.currentConsumerId;
                    let hasOrganizationMemberAccess = participant.hasOrganizationMemberAccess;
                    let grantedPermission = consumerProfileId
                      ? grantedPermissionByProfileId.get(consumerProfileId)
                      : undefined;
                    let participantPermission = isOwner
                      ? 'owner'
                      : hasOrganizationMemberAccess
                        ? 'manage'
                        : consumerProfileId && skillAccess.data
                          ? (grantedPermission ?? 'none')
                          : getParticipantPermission(participant.roles);
                    let participantAccessItems = isOwner
                      ? [...accountAccessItems, ownerAccessItem]
                      : hasOrganizationMemberAccess
                        ? [manageAccessItem]
                        : canAssignOwners && !isOrganizationMember
                          ? [...accountAccessItems, ownerAccessItem]
                          : accountAccessItems;
                    return (
                      <AccessRow key={participant.id}>
                        <Avatar
                          entity={{
                            name: participant.actor.name,
                            imageUrl: participant.actor.imageUrl ?? undefined
                          }}
                          size={36}
                        />
                        <PersonInfo>
                          <PersonName>
                            <Truncate>{participant.actor.name}</Truncate>
                          </PersonName>
                          <Muted>{participant.actor.email}</Muted>
                        </PersonInfo>
                        <AccessSelectWrap>
                          <Select
                            label="Access"
                            hideLabel
                            size="2"
                            disabled={
                              hasOrganizationMemberAccess ||
                              !canManageAccess ||
                              !consumerProfileId ||
                              (isOwner && mode != 'dashboard') ||
                              isCurrentConsumer ||
                              (mode == 'portal' && isOrganizationMember)
                            }
                            value={participantPermission}
                            items={participantAccessItems}
                            onChange={value => {
                              if (isAccountPermission(value)) {
                                updateAccountAccess(participant, value);
                              }
                            }}
                          />
                        </AccessSelectWrap>
                      </AccessRow>
                    );
                  })}

                  {canManagePortalGroups &&
                    groupAccesses.map(access => (
                      <AccessRow key={access.id}>
                        <Avatar
                          entity={{
                            name: access.consumerGroup.name,
                            imageUrl: `https://avatar.metorial-cdn.com/${access.consumerGroup.id}`
                          }}
                          size={36}
                        />
                        <PersonInfo>
                          <PersonName>
                            <Truncate>{access.consumerGroup.name}</Truncate>
                            <GroupPill>Access Group</GroupPill>
                          </PersonName>
                          <Muted>{access.consumerGroup.description || 'Access Group'}</Muted>
                        </PersonInfo>
                        <AccessSelectWrap>
                          <Select
                            label="Access"
                            hideLabel
                            size="2"
                            value={access.accessLevel ?? 'read'}
                            disabled={
                              removingGroupId == access.id || updatePortalAccess.isLoading
                            }
                            items={groupAccessItems}
                            onChange={value => {
                              if (value == 'none') removeGroupAccess(access.id);
                              else if (isGroupPermission(value)) {
                                updateGroupAccess(access.id, value);
                              }
                            }}
                          />
                        </AccessSelectWrap>
                      </AccessRow>
                    ))}

                  {canManagePortalGroups &&
                    inheritedGroupAccesses.map(access => (
                      <AccessRow key={access.id}>
                        <Avatar
                          entity={{
                            name: access.consumerGroup.name,
                            imageUrl: `https://avatar.metorial-cdn.com/${access.consumerGroup.id}`
                          }}
                          size={36}
                        />
                        <PersonInfo>
                          <PersonName>
                            <Truncate>{access.consumerGroup.name}</Truncate>
                            <GroupPill>Access Group</GroupPill>
                          </PersonName>
                          <Muted>
                            Through{' '}
                            {access.access.type == 'skill_group'
                              ? access.access.skillGroup.name
                              : access.name}
                          </Muted>
                        </PersonInfo>
                        <AccessSelectWrap>
                          <Select
                            label="Inherited access"
                            hideLabel
                            size="2"
                            disabled
                            value={access.accessLevel ?? 'read'}
                            items={groupLevelItems}
                          />
                        </AccessSelectWrap>
                      </AccessRow>
                    ))}

                  {!participants.isLoading &&
                    accessibleParticipants.length == 0 &&
                    groupAccesses.length == 0 &&
                    inheritedGroupAccesses.length == 0 && (
                      <EmptyState>
                        <Text size="2" color="gray600">
                          Nobody has been added yet.
                        </Text>
                      </EmptyState>
                    )}
                </RowList>
              </>
            )}
          </ContentPanel>

          {mode == 'dashboard' && !isSearching && everyoneGroup && (
            <AccessSection>
              <AccessRow>
                <IconAvatar $size={36}>
                  <RiGroupLine size={18} />
                </IconAvatar>
                <PersonInfo>
                  <PersonName>
                    <Truncate>Everyone at {portalName}</Truncate>
                  </PersonName>
                  <Muted>Anyone with a portal account</Muted>
                </PersonInfo>
                <AccessSelectWrap>
                  <Select
                    label="Access for everyone"
                    hideLabel
                    size="2"
                    value={everyoneAccess ? (everyoneAccess.accessLevel ?? 'read') : 'none'}
                    disabled={
                      createPortalAccess.isLoading ||
                      updatePortalAccess.isLoading ||
                      (!!everyoneAccess && removingGroupId == everyoneAccess.id)
                    }
                    items={[...groupLevelItems, { id: 'none', label: 'No access' }]}
                    onChange={setEveryoneAccess}
                  />
                </AccessSelectWrap>
              </AccessRow>
            </AccessSection>
          )}

          {mode == 'dashboard' && !isSearching && (
            <SelfPortalFooter>
              <SelfPortalText>
                <SelfPortalTitle>
                  {!ownProfile
                    ? `You haven't opened ${portalName} yet`
                    : ownGrantedDirectly
                      ? `In your portal`
                      : ownGroupAccess
                        ? `In your portal`
                        : `Not in your portal`}
                </SelfPortalTitle>
                <Muted style={{ whiteSpace: 'normal' }}>
                  {!ownProfile
                    ? 'Open it once to be able to add skills to it. You can always open this skill here in the dashboard.'
                    : ownGrantedDirectly
                      ? 'You can see the skill in the portal.'
                      : 'You can see the skill here, but not in the portal.'}
                </Muted>
              </SelfPortalText>
              <Switch
                hideLabel
                label="Show in my portal"
                checked={ownGrantedDirectly || !!ownGroupAccess}
                disabled={!ownProfile || !!ownGroupAccess || shareSkill.isLoading}
                onCheckedChange={toggleOwnPortalAccess}
              />
            </SelfPortalFooter>
          )}

          <div>
            <shareSkill.RenderError />
            <createPortalAccess.RenderError />
            <deletePortalAccess.RenderError />
            <updatePortalAccess.RenderError />
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
