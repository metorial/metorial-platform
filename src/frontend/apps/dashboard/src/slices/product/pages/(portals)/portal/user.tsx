import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal, usePortalConsumerProfile } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let PortalUserPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);
  let user = usePortalConsumerProfile(instance.data?.id, params.portalId!, params.userId!);

  return (
    <>
      {renderWithLoader({ portal, user })(({ portal, user }) => (
        <>
          <Attributes
            itemWidth="300px"
            attributes={[
              {
                label: 'Name',
                content: user.data.name
              },
              {
                label: 'User ID',
                content: <ID id={user.data.id} />
              },
              {
                label: 'Created At',
                content: <RenderDate date={user.data.createdAt!} />
              }
            ]}
          />

          <Spacer height={25} />
        </>
      ))}
    </>
  );
};
