import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useConsumer, useCurrentInstance, useIdentityActors } from '@metorial/state';
import { Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IdentityDelegationsTable } from '../../../scenes/identity/delegationsTable';

export let ConsumerDelegationsPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);
  let actors = useIdentityActors(instance.data?.id, {
    consumerId,
    order: 'desc'
  });

  return renderWithLoader({ instance, consumer })(({ instance }) =>
    renderWithPagination(actors)(actors => (
      <>
        {actors.data.items.length === 0 ? (
          <Text size="2" color="gray600">
            No actors are linked to this account yet.
          </Text>
        ) : (
          actors.data.items.map((actor, idx) => (
            <div key={actor.id}>
              {idx > 0 ? <Spacer size={20} /> : null}
              <Box title={actor.name} description="Delegations granted to this linked actor.">
                <IdentityDelegationsTable
                  instanceId={instance.data.id}
                  filters={{ delegateeActorId: actor.id }}
                />
              </Box>
            </div>
          ))
        )}
      </>
    ))
  );
};
