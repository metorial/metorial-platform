import { renderWithLoader } from '@metorial/data-hooks';
import { ReadmeHtml } from '@metorial/markdown';
import { Attributes, Callout, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { useServerListing, useServerListingReadme } from '../../../../state/consumer/listings';
import { useServer } from '../../../../state/consumer/servers';
import { usePaths } from '../../../../state/portal/path';

export let ServerPage = () => {
  let { serverId } = useParams();
  let server = useServer(serverId);
  let listing = useServerListing(serverId);
  let readme = useServerListingReadme(serverId);
  let Paths = usePaths();

  return renderWithLoader({ server, listing, readme })(({ server, listing, readme }) => (
    <>
      {!server.data?.variants.length && (
        <Callout color="orange">
          <span>This server isn't supported by Metorial yet.</span>
        </Callout>
      )}

      <Spacer height={15} />

      <Attributes
        attributes={[
          ...(listing.data.repository
            ? [
                {
                  label: 'Repository',
                  content: (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={listing.data.repository.providerUrl}
                    >
                      {listing.data.repository.identifier.replace('github.com/', '')}
                    </a>
                  )
                }
              ]
            : [
                {
                  label: 'Type',
                  content: 'Custom Server'
                }
              ]),
          {
            label: 'Vendor',
            content: listing.data.vendor?.name ?? listing.data.profile?.name
          },
          {
            label: 'Server ID',
            content: <ID id={server.data?.id} />
          }
        ]}
      />

      <Spacer height={15} />

      {readme.data.readmeHtml && <ReadmeHtml readmeHtml={readme.data.readmeHtml} />}
    </>
  ));
};
