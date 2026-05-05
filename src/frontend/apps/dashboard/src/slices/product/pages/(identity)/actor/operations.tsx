import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useIdentityActor } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ToolCallsTable } from '../../../scenes/logs/toolCallsTable';

export let IdentityActorOperationsPage = () => {
  let instance = useCurrentInstance();
  let { identityActorId } = useParams();
  let actor = useIdentityActor(instance.data?.id, identityActorId);

  return renderWithLoader({ instance, actor })(({ instance, actor }) => (
    <ToolCallsTable instanceId={instance.data.id} filters={{ actorId: actor.data.id }} />
  ));
};
