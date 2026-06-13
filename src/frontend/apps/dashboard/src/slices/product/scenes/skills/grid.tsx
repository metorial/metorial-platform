import type { DashboardInstanceSkillsListQuery } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAllProviderListings,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDuplicateSkill,
  useSkills
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { showSkillCloneFormModal } from './cloneModal';
import { showSkillFormModal } from './modal';

let Alias = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

let ProviderAvatarStack = styled.div`
  display: flex;
  align-items: center;
`;

let ProviderAvatarItem = styled.div<{ $index: number }>`
  position: relative;
  z-index: ${p => 10 - p.$index};
  margin-left: ${p => (p.$index === 0 ? '0' : '-8px')};
  border-radius: 999px;
  box-shadow: 0 0 0 2px ${theme.colors.background};
`;

export let SkillGridCard = (p: {
  skill: {
    id: string;
    name: string;
    description?: string | null;
    slug: string;
    imageUrl?: string | null;
    providers?: {
      id: string;
      name?: string | null;
      slug: string;
    }[];
  };
  listingLookup: Map<
    string,
    { name: string | null | undefined; imageUrl: string | null | undefined }
  >;
  onClick?: () => void;
  menu?: {
    label: string;
    onClick: () => void;
  }[];
}) => {
  let visibleProviders = (p.skill.providers ?? []).slice(0, 5);

  return (
    <ItemGrid.Item
      entity={{ id: p.skill.id, hasUsage: true }}
      title={p.skill.name}
      description={
        <Description>{p.skill.description || 'No description provided yet.'}</Description>
      }
      height={200}
      onClick={p.onClick}
      menu={p.menu}
      icon={
        visibleProviders.length > 0 ? (
          <ProviderAvatarStack>
            <ProviderAvatarItem $index={0}>
              <Avatar
                entity={{
                  name: p.skill.name,
                  imageUrl: p.skill.imageUrl
                }}
                size={30}
                noTooltip
                imageFit="contain"
              />
            </ProviderAvatarItem>
            {visibleProviders.map((provider, idx) => {
              let listing = p.listingLookup.get(provider.id);
              let name = listing?.name ?? provider.name ?? provider.slug;

              return (
                <ProviderAvatarItem key={provider.id} $index={idx + 1}>
                  <Avatar
                    entity={{
                      name,
                      photoUrl: listing?.imageUrl ?? undefined
                    }}
                    size={30}
                    noTooltip
                    imageFit="contain"
                  />
                </ProviderAvatarItem>
              );
            })}
          </ProviderAvatarStack>
        ) : (
          <Avatar
            entity={{
              name: p.skill.name,
              imageUrl: p.skill.imageUrl
            }}
            size={30}
            imageFit="contain"
          />
        )
      }
      bottom={
        <div style={{ display: 'flex' }}>
          <Alias>{p.skill.slug}</Alias>
        </div>
      }
    />
  );
};

export let SkillsGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillsListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let duplicateSkill = useDuplicateSkill();
  let skills = useSkills(instanceId, {
    order: 'desc',
    status: ['active', 'archived'],
    ...query
  });
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (skills.data?.items ?? []).flatMap(skill =>
            (skill.providers ?? []).map(provider => provider.id)
          )
        )
      ].sort(),
    [skills.data?.items]
  );
  let providerListings = useAllProviderListings(instanceId, providerIds);
  let hasActiveFilters = !!(
    query.search ||
    query.providerId ||
    query.integrationId ||
    query.skillGroupId ||
    query.createdAt ||
    query.updatedAt ||
    (Array.isArray(query.status) ? query.status.length > 0 : query.status)
  );

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillFormModal({
      instanceId: instance.data.id,
      onCreate: skill => {
        navigate(
          Paths.instance.skill(organization.data, project.data, instance.data, skill.id)
        );
      }
    });
  };

  let duplicate = (skill: { id: string; name: string; description: string | null }) => {
    if (!instance.data) return;

    showSkillCloneFormModal({
      title: 'Duplicate Skill',
      description: 'Choose a name and description for the duplicated skill.',
      submitLabel: 'Duplicate Skill',
      initialName: `Copy of ${skill.name}`,
      initialDescription: skill.description,
      onSubmit: async values => {
        let [duplicatedSkill] = await duplicateSkill.mutate({
          instanceId: instance.data!.id,
          skillId: skill.id,
          name: values.name,
          description: values.description
        });

        if (!duplicatedSkill) return false;

        navigate(
          Paths.instance.skill(
            organization.data,
            project.data,
            instance.data,
            duplicatedSkill.id
          )
        );
      }
    });
  };

  return renderWithPagination(skills, {
    emptyState: (
      <>
        {query.search && (
          <Text size="2" color="gray600">
            No skills found.
          </Text>
        )}

        {!hasActiveFilters && (
          <EmptyState
            extra="Skills"
            title="Create your first skill"
            description="Skills let you extend integrations with documents, custom logic, and resources to create advanced agent workflows."
            action={{
              label: 'Create Skill',
              onClick: showCreateModal
            }}
          />
        )}

        {!query.search && hasActiveFilters && (
          <Text size="2" color="gray600">
            No skills match the current filters.
          </Text>
        )}
      </>
    )
  })(skills =>
    renderWithLoader({ providerListings })(({ providerListings }) => {
      let listingLookup = new Map<
        string,
        { name: string | null | undefined; imageUrl: string | null | undefined }
      >();

      for (let listing of providerListings.data) {
        let preview = {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        };

        listingLookup.set(listing.id, preview);
        listingLookup.set(listing.provider.id, preview);
      }

      return (
        <>
          {skills.data.items.length > 0 && (
            <ItemGrid.Root width="300px">
              {skills.data.items.map(skill => (
                <SkillGridCard
                  key={skill.id}
                  skill={skill}
                  listingLookup={listingLookup}
                  onClick={() =>
                    navigate(
                      Paths.instance.skill(
                        organization.data,
                        project.data,
                        instance.data,
                        skill.id
                      )
                    )
                  }
                  menu={[
                    {
                      label: 'Duplicate Skill',
                      onClick: () => duplicate(skill)
                    }
                  ]}
                />
              ))}
            </ItemGrid.Root>
          )}
        </>
      );
    })
  );
};
