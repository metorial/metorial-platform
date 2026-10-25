import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Avatar, Badge, Button, Entity, Text, theme } from '@metorial/ui';
import { RiEyeOffLine, RiLockLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import type { OwnedResource, ResourceOwnerActor } from '../lib/resourceOwnership';

let Inline = styled.div`
  display: inline-flex;
  align-items: center;
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
  person: 'Person',
  agent: 'Agent'
};

let getOwnerName = (owner: ResourceOwnerActor) => owner.name ?? ownerTypeLabel[owner.type];

let useOwnerUrl = (owner: ResourceOwnerActor) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  if (!owner.portalId) return null;

  if (owner.type === 'consumer') {
    if (!owner.consumerProfileId) return null;

    return Paths.instance.portal(
      organization.data,
      project.data,
      instance.data,
      owner.portalId,
      'account',
      owner.consumerProfileId
    );
  }

  return Paths.instance
    .portalIdentity(owner.portalId)
    .actor(organization.data, project.data, instance.data, owner.id);
};

let OwnerAvatar = ({ owner, size }: { owner: ResourceOwnerActor; size: number }) => (
  <Avatar entity={{ name: getOwnerName(owner), imageUrl: owner.imageUrl }} size={size} />
);

export let ResourceOwnerLockBadge = ({ resource }: { resource: OwnedResource }) =>
  resource.ownerActor && resource.isOwnerOnlyVisible ? (
    <Badge color="gray">
      <RiEyeOffLine size={12} /> Only visible to owner
    </Badge>
  ) : resource.ownerActor && resource.isOwnerLocked ? (
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
  let owner = resource.ownerActor;
  if (!owner)
    return (
      <Text size="2" color="gray600">
        -
      </Text>
    );

  return (
    <ResourceOwnerInlineContent
      owner={owner}
      isOwnerLocked={!!resource.isOwnerLocked}
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
    <Inline>
      <OwnerAvatar owner={owner} size={18} />
      <InlineName>{getOwnerName(owner)}</InlineName>
      {isOwnerLocked && <RiLockLine size={12} color={theme.colors.gray600} />}
    </Inline>
  );

  return url && linked ? <Link to={url}>{content}</Link> : content;
};

export let ResourceOwnerEntity = ({
  resource,
  title = 'Owner'
}: {
  resource: OwnedResource;
  title?: string;
}) => {
  let owner = resource.ownerActor;
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
            resource.isOwnerOnlyVisible
              ? `${ownerTypeLabel[owner.type]} · Only visible to owner`
              : resource.isOwnerLocked
                ? `${ownerTypeLabel[owner.type]} · Locked to owner`
                : ownerTypeLabel[owner.type]
          }
        />

        {url && (
          <Entity.Field title={owner.type === 'consumer' ? 'Account' : 'Actor'} right>
            <Link to={url}>
              <Button as="span" size="2" variant="outline">
                {owner.type === 'consumer' ? 'View Account' : 'View Actor'}
              </Button>
            </Link>
          </Entity.Field>
        )}
      </Entity.Content>
    </Entity.Wrapper>
  );
};
