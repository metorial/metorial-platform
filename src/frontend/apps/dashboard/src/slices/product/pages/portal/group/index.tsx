import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortalConsumerGroup } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalGroupAccess } from '../../../scenes/portals/groupAccess';

export let PortalGroupOverviewPage = () => {
  let instance = useCurrentInstance();
  let { portalId, groupId } = useParams();
  let group = usePortalConsumerGroup(instance.data?.id, portalId, groupId);

  if (!portalId || !groupId) return null;

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: group.data.name
          },
          {
            label: 'Group ID',
            content: <ID id={group.data.id} />
          },
          {
            label: 'Type',
            content: group.data.isDefault
              ? 'Default'
              : group.data.ssoGroupIds.length
                ? 'SSO'
                : 'Manual'
          }
        ]}
      />

      <Spacer size={15} />

      <PortalGroupAccess portalId={portalId} groupId={group.data.id} />
    </>
  ));
};
