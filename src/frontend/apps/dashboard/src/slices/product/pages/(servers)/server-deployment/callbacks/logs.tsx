import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackLogsList } from '../../../../scenes/callbacks/logs';

export let ServerDeploymentCallbackLogsPage = () => {
  let { serverDeploymentId } = useParams();
  let instance = useCurrentInstance();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return <CallbackLogsList callbackId={deployment.data?.callback?.id} />;
};
