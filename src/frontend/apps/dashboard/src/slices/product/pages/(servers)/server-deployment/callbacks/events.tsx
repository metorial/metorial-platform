import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackEventsList } from '../../../../scenes/callbacks/events';

export let ServerDeploymentCallbackEventsPage = () => {
  let { serverDeploymentId } = useParams();
  let instance = useCurrentInstance();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return <CallbackEventsList callbackId={deployment.data?.callback?.id} />;
};
