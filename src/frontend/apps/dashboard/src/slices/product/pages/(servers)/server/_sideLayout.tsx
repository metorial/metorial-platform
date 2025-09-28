import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServer, useServerListing } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';

export let ServerLayoutSide = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let listing = useServerListing(serverId);

  return renderWithLoader({ server, listing })(({ server, listing }) => (
    <AttributesLayout
      variant="large"
      items={[
        { label: 'Server ID', value: listing.data.slug },
        { label: 'Server Name', value: server.data.name },
        {
          label: 'Server Type',
          value: { public: 'Public', custom: 'Custom' }[server.data.type] ?? server.data.type
        },
        { label: 'Vendor', value: listing.data.vendor?.name },
        { label: 'Type', value: listing.data.isOfficial ? 'Official' : 'Community' },
        { label: 'Hosting', value: listing.data.isHostable ? 'Hostable' : 'Not Hostable' },
        {
          label: 'Provider',
          value: server.data.variants.some(v => v.source.type == 'remote')
            ? 'Remote'
            : 'Metorial'
        }
      ]}
    >
      <Outlet />
    </AttributesLayout>
  ));
};
