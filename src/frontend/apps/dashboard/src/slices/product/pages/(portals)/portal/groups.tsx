import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PortalConsumerGroupsTable } from '../../../scenes/portals/groupsTable';

export let PortalGroupsPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <PortalConsumerGroupsTable portalId={portal.data?.id} />
      ))}
    </>
  );
};
