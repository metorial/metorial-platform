import { Entity, Text, theme } from '@metorial/ui';
import type { ReactNode } from 'react';
import {
  OverviewEntityIcon,
  OverviewHint,
  OverviewList,
  OverviewStack
} from '../styles';
import type { EntityDetail } from '../types';

export let CatalogOverview = ({
  emptyText,
  icon,
  items,
  moreText
}: {
  emptyText: string;
  icon: ReactNode;
  items: {
    description?: string | null;
    details?: EntityDetail[];
    id: string;
    title: string;
  }[];
  moreText?: string | null;
}) => {
  if (items.length === 0) {
    return (
      <Text size="1" color="gray700">
        {emptyText}
      </Text>
    );
  }

  return (
    <OverviewStack>
      <OverviewList>
        {items.map(item => (
          <Entity.Wrapper style={{ background: theme.colors.background }} key={item.id}>
            <Entity.Content>
              <Entity.Field
                title={item.title}
                description={item.description ?? undefined}
                prefix={<OverviewEntityIcon>{icon}</OverviewEntityIcon>}
              />
              {(item.details ?? []).map(detail => (
                <Entity.Field
                  key={`${item.id}-${detail.label}`}
                  title={detail.label}
                  value={detail.value}
                />
              ))}
            </Entity.Content>
          </Entity.Wrapper>
        ))}
      </OverviewList>

      {moreText ? <OverviewHint>{moreText}</OverviewHint> : null}
    </OverviewStack>
  );
};
