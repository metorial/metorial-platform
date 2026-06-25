import { Entity, theme } from '@metorial/ui';
import type { ReactNode } from 'react';
import { OverviewEntityIcon, OverviewStack } from '../styles';
import type { EntityDetail } from '../types';
import { getDisplayName } from '../utils';

export let IdentityOverview = ({
  fallbackTitle,
  icon,
  info
}: {
  fallbackTitle: string;
  icon: ReactNode;
  info: Record<string, any> | null | undefined;
}) => {
  let title = getDisplayName(info, fallbackTitle);
  let details = [
    info?.name ? { label: 'Name', value: String(info.name) } : null,
    info?.version ? { label: 'Version', value: String(info.version) } : null,
    info?.websiteUrl ? { label: 'Website', value: String(info.websiteUrl) } : null
  ].filter(Boolean) as EntityDetail[];

  return (
    <OverviewStack>
      <Entity.Wrapper style={{ background: theme.colors.background }}>
        <Entity.Content>
          <Entity.Field
            title={title}
            prefix={<OverviewEntityIcon>{icon}</OverviewEntityIcon>}
          />
          {details.map(detail => (
            <Entity.Field key={detail.label} title={detail.label} value={detail.value} />
          ))}
        </Entity.Content>
      </Entity.Wrapper>
    </OverviewStack>
  );
};
