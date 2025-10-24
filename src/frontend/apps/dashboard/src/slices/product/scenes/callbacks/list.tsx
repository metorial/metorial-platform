import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCallbacks, useCurrentInstance } from '@metorial/state';
import { Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let CallbacksList = () => {
  let instance = useCurrentInstance();
  let callbacks = useCallbacks(instance.data?.id, {
    order: 'desc'
  });

  return (
    <>
      {renderWithPagination(callbacks)(callbacks => (
        <>
          <Table
            headers={['Info', 'Created']}
            data={callbacks.data.items.map(callback => ({
              data: [
                <Flex gap={3} direction="column">
                  <Text size="2" weight="strong">
                    {callback.name ?? <span>Untitled</span>}
                  </Text>
                  <Text size="1" color="gray600" truncate>
                    {callback.description}
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
              No callbacks for this callback.
            </Text>
          )}
        </>
      ))}
    </>
  );
};
