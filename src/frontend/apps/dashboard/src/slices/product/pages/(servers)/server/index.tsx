import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServer, useServerListing } from '@metorial/state';
import { Datalist } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 50px;
`;

let Main = styled.main``;

let Aside = styled.aside``;

export let ServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let listing = useServerListing(serverId);

  return renderWithLoader({ server, listing })(({ server, listing }) => (
    <Grid>
      <Main>{listing.data.readme}</Main>
      <Aside>
        <Datalist
          items={[
            { label: 'Server ID', value: listing.data.slug },
            { label: 'Server Name', value: server.data.name },
            {
              label: 'Server Type',
              value: { public: 'Public' }[server.data.type] ?? server.data.type
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
        />
      </Aside>
    </Grid>
  ));
};
