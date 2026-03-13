import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIdentityActor } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { IdentitiesTable } from '../../../scenes/identity/identitiesTable';

export let IdentityActorPage = () => {
  let instance = useCurrentInstance();
  let { identityActorId } = useParams();
  let actor = useIdentityActor(instance.data?.id, identityActorId);

  return renderWithLoader({ instance, actor })(({ instance, actor }) => (
    <>
      <Attributes
        itemWidth="240px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={actor.data.id} />
          },
          {
            label: 'Type',
            content: actor.data.type
          },
          {
            label: 'Status',
            content: actor.data.status
          },
          {
            label: 'Agent ID',
            content: actor.data.agentId ? <ID id={actor.data.agentId} /> : '—'
          },
          {
            label: 'Created At',
            content: <RenderDate date={actor.data.createdAt} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={actor.data.updatedAt} />
          }
        ]}
      />

      <Spacer size={20} />

      <Box title="Identities" description="Identities owned by this actor.">
        <IdentitiesTable instanceId={instance.data.id} filters={{ actorId: actor.data.id }} />
      </Box>
    </>
  ));
};
