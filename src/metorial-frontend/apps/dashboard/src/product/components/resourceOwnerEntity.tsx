import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortals
} from '@metorial/state';
import { Avatar, Badge, Button, Entity, Text, theme } from '@metorial/ui';
import { RiEyeOffLine, RiLockLine } from '@remixicon/react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import type { OwnedResource, ResourceOwnerActor } from '../lib/resourceOwnership';

let Inline = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  line-height: 1;
  gap: 6px;
  min-width: 0;
`;

let InlineName = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray900};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ownerTypeLabel: Record<ResourceOwnerActor['type'], string> = {
  consumer: 'Workforce Account',
  organization_member: 'Organization Member',
  person: 'Person',
  agent: 'Agent'
};

let getOwnerName = (owner: ResourceOwnerActor) => owner.name ?? ownerTypeLabel[owner.type];

let useOwnerUrl = (owner: ResourceOwnerActor) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  let { portalId: routePortalId } = useParams();
  let portals = usePortals(
    owner.consumer && !owner.consumer.portalId && !routePortalId ? instance.data?.id : null,
    { limit: 1, order: 'asc' }
  );
  let portalId = owner.consumer?.portalId ?? routePortalId ?? portals.data?.items[0]?.id;

  if (!owner.consumer || !portalId) return null;

  return Paths.instance.portal(
    organization.data,
    project.data,
    instance.data,
    portalId,
    'account',
    owner.consumer.profileId
  );
};

let OwnerAvatar = ({ owner, size }: { owner: ResourceOwnerActor; size: number }) => (
  <Avatar entity={{ name: getOwnerName(owner), imageUrl: owner.imageUrl }} size={size} />
);

export let ResourceOwnerLockBadge = ({ resource }: { resource: OwnedResource }) =>
  resource.access?.owner && resource.access?.visibility === 'owner' ? (
    <Badge color="gray">
      <RiEyeOffLine size={12} /> Only visible to you
    </Badge>
  ) : resource.access?.owner && resource.access?.type === 'owner_locked' ? (
    <Badge color="gray">
      <RiLockLine size={12} /> Owner only
    </Badge>
  ) : null;

export let ResourceOwnerInline = ({
  resource,
  linked = true
}: {
  resource: OwnedResource;
  linked?: boolean;
}) => {
  let owner = resource.access?.owner;
  if (!owner)
    return (
      <Text size="2" color="gray600">
        -
      </Text>
    );

  return (
    <ResourceOwnerInlineContent
      owner={owner}
      isOwnerLocked={resource.access?.type === 'owner_locked'}
      linked={linked}
    />
  );
};

let ResourceOwnerInlineContent = ({
  owner,
  isOwnerLocked,
  linked
}: {
  owner: ResourceOwnerActor;
  isOwnerLocked: boolean;
  linked: boolean;
}) => {
  let url = useOwnerUrl(owner);
  let content = (
    <>
      <OwnerAvatar owner={owner} size={18} />
      <InlineName>{getOwnerName(owner)}</InlineName>
      {isOwnerLocked && <RiLockLine size={12} color={theme.colors.gray600} />}
    </>
  );

  return url && linked ? (
    <Inline as={Link} to={url}>
      {content}
    </Inline>
  ) : (
    <Inline>{content}</Inline>
  );
};

export let ResourceOwnerEntity = ({
  resource,
  title = 'Owner'
}: {
  resource: OwnedResource;
  title?: string;
}) => {
  let owner = resource.access?.owner;
  if (!owner) return null;

  return <ResourceOwnerEntityContent owner={owner} resource={resource} title={title} />;
};

let ResourceOwnerEntityContent = ({
  owner,
  resource,
  title
}: {
  owner: ResourceOwnerActor;
  resource: OwnedResource;
  title: string;
}) => {
  let url = useOwnerUrl(owner);

  return (
    <Entity.Wrapper header={title}>
      <Entity.Content>
        <Entity.Field
          prefix={<OwnerAvatar owner={owner} size={28} />}
          title={getOwnerName(owner)}
          description={
            resource.access?.visibility === 'owner'
              ? `${ownerTypeLabel[owner.type]} · Only visible to you`
              : resource.access?.type === 'owner_locked'
                ? `${ownerTypeLabel[owner.type]} · Locked to owner`
                : ownerTypeLabel[owner.type]
          }
        />

        {url && (
          <Entity.Field title="Account" right>
            <Link to={url}>
              <Button as="span" size="2" variant="outline">
                View Account
              </Button>
            </Link>
          </Entity.Field>
        )}
      </Entity.Content>
    </Entity.Wrapper>
  );
};
