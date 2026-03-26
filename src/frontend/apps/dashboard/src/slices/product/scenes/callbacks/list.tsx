import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCallbacks, useCurrentInstance } from '@metorial/state';
import { Flex, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let CallbacksList = () => {
  let instance = useCurrentInstance();
  let callbacks = useCallbacks(instance.data?.id, {
    order: 'desc'
  });

  return renderWithPagination(callbacks)(callbacks => (
    <>
      <Table
        headers={['Info', 'Deployment', 'Created']}
        data={callbacks.data.items.map(callback => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {callback.name || (
                  <span style={{ color: theme.colors.gray600 }}>
                    Callback {callback.id.slice(0, 8)}...
                  </span>
                )}
              </Text>
              <Text size="1" color="gray600" truncate>
                {callback.description || 'No description'}
              </Text>
            </Flex>,
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {callback.providerDeployment.name || callback.providerDeployment.id}
              </Text>
              <Text size="1" color="gray600" truncate>
                {callback.providerTriggers.length}{' '}
                {callback.providerTriggers.length === 1 ? 'trigger' : 'triggers'}
              </Text>
            </Flex>,
            <RenderDate date={callback.createdAt} />
          ],
          href: Paths.instance.callback(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            callback.id
          )
        }))}
      />

      {callbacks.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No callbacks found.
        </Text>
      )}
    </>
  ));
};
