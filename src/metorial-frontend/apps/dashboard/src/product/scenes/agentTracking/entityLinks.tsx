import { Paths } from '@metorial/frontend-config';
import { Text } from '@metorial/ui';
import React from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { providerLabel } from './providerCalls';

let EntityLink = ({
  to,
  muted,
  children
}: {
  to: string;
  muted?: boolean;
  children: React.ReactNode;
}) => (
  <Link to={to}>
    {muted ? (
      <Text as="span" size="1" color="gray600">
        {children}
      </Text>
    ) : (
      children
    )}
  </Link>
);

export let ProviderLink = ({
  provider,
  muted
}: {
  provider: { id: string; name: string | null };
  muted?: boolean;
}) => {
  let ctx = useInstanceContext();

  if (!provider.name) {
    return (
      <Text as="span" size={muted ? '1' : '2'} color="gray600">
        {providerLabel(provider)}
      </Text>
    );
  }

  return (
    <EntityLink
      to={Paths.instance.provider(ctx.organization, ctx.project, ctx.instance, provider.id)}
      muted={muted}
    >
      {provider.name}
    </EntityLink>
  );
};

export let SkillLink = ({ skill }: { skill: { id: string; name: string } }) => {
  let ctx = useInstanceContext();

  return (
    <EntityLink
      to={Paths.instance.skill(ctx.organization, ctx.project, ctx.instance, skill.id)}
    >
      {skill.name}
    </EntityLink>
  );
};
