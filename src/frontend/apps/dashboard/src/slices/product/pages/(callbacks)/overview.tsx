import { useParams } from 'react-router-dom';
import { CallbackOverview } from '../../scenes/callbacks/overview';

export let CallbackOverviewPage = () => {
  let { callbackId } = useParams();

  return <CallbackOverview callbackId={callbackId} />;
};
