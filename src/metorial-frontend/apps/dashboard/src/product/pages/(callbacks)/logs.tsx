import { useParams } from 'react-router-dom';
import { CallbackLogsList } from '../../scenes/callbacks/logs';

export let CallbackLogsPage = () => {
  let { callbackId } = useParams();

  return <CallbackLogsList callbackId={callbackId} />;
};
