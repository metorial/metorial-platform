import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal, usePortalConsumerGroup } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PortalGroupAccess } from '../../../../scenes/portals/groupAccess';

export let PortalGroupOverviewPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);
  let group = usePortalConsumerGroup(instance.data?.instanceId, portal.data?.id, params.groupId);

  return renderWithLoader({ group, portal })(({ group, portal }) => (
    <>
      <PortalGroupAccess portalId={portal.data.id} groupId={group.data.id} />
    </>
  ));
};
