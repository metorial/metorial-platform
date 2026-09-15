import type { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  CallbackPreview,
  useCallbacks,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import type { ReactNode } from 'react';

export let CallbacksGrid = ({
  instanceId,
  filters,
  emptyState
}: {
  instanceId: string;
  filters?: Omit<DashboardInstanceCallbacksListQuery, 'limit' | 'after' | 'before' | 'cursor'>;
  emptyState?: string | (() => ReactNode);
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let callbacks = useCallbacks(instanceId, {
    order: 'desc',
    ...filters
  });

  return renderWithPagination(callbacks)(callbacks => (
    <>
      {callbacks.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {callbacks.data.items.map(callback => (
            <ItemGrid.Item
              key={callback.id}
              href={Paths.instance.callback(
                organization.data,
                project.data,
                instance.data,
                callback.id
              )}
              entity={{ id: callback.id, hasUsage: true }}
              title={callback.name}
              variant="v2"
              height={200}
              icon={
                <Avatar
                  entity={{
                    name: callback.name,
                    imageUrl: `https://avatar-cdn.metorial.com/${callback.id}`
                  }}
                  size={30}
                />
              }
              bottom={
                <Text size="1">{callback.provider.name}</Text>
              }
            />
          ))}
        </ItemGrid.Root>
      )}

      {callbacks.data.items.length === 0 && (
        <Text size="2" color="gray600">
          {typeof emptyState === 'function' ? emptyState() : emptyState}
        </Text>
      )}
    </>
  ));
};
