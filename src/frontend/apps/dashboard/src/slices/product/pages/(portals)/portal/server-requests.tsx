import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PortalConsumerServerRequestsTable } from '../../../scenes/portals/serverRequests';

export let PortalServerRequestsPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <PortalConsumerServerRequestsTable portalId={portal.data?.id} status="pending" />
      ))}
    </>
  );
};
