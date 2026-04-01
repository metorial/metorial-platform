import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Entity, RenderDate, Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';

export let PortalOverviewPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);

  return renderWithLoader({ portal })(({ portal }) => (
    <>
      <Spacer size={15} />

      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field title="Slug" value={portal.data.slug} />
          <Entity.Field
            title="Default URL"
            value={portal.data.urls[0]?.url ?? 'No URL configured'}
          />
          <Entity.Field
            title="Session Expiry"
            value={`${portal.data.auth.sessionExpiryTimeInSeconds} seconds`}
          />
          <Entity.Field title="Brand Name" value={portal.data.brand.name} />
          <Entity.Field
            title="Created"
            value={<RenderDate date={portal.data.createdAt} />}
          />
          <Entity.Field
            title="Updated"
            value={<RenderDate date={portal.data.updatedAt} />}
          />
        </Entity.Content>
      </Entity.Wrapper>
    </>
  ));
};
