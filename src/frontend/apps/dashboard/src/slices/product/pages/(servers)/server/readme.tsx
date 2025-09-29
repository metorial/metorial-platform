import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ReadmeHtml } from '@metorial/markdown';
import { useCurrentInstance, useServer, useServerListing } from '@metorial/state';
import { Attributes, Button, Callout, LinkButton, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';

export let ServerReadmePage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let listing = useServerListing(instance.data?.id, serverId);

  return renderWithLoader({ server, listing })(({ server, listing }) => (
    <>
      {!server.data?.variants.length ? (
        <Callout color="orange">
          <span>
            This server isn't supported by Metorial yet. Please{' '}
            <LinkButton
              onClick={() => {
                // @ts-ignore
                window.metorial_enterprise?.chrome?.showContactSupportModal({
                  subject: `Support for ${server.data.name} server`,
                  message: `Hey team,
I would like to request support for the ${server.data.name} server (ID: ${server.data.id}) in Metorial. Please let me know if you need any additional information from my side.`
                });
              }}
            >
              reach out
            </LinkButton>{' '}
            if you want to see it supported.
          </span>
        </Callout>
      ) : (
        <SideBox
          title="Test this server"
          description="Use the Metorial Explorer to test this server."
        >
          <Link
            to={Paths.instance.explorer(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              { server_id: server.data?.id }
            )}
          >
            <Button as="span" size="2">
              Open Explorer
            </Button>
          </Link>
        </SideBox>
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
                  content: 'Closed Source'
                }
              ]),
          {
            label: 'Vendor',
            content: listing.data.vendor?.name
          },
          {
            label: 'Server ID',
            content: <ID id={server.data?.id} />
          }
        ]}
      />

      <Spacer height={15} />

      {listing.data.readmeHtml && <ReadmeHtml readmeHtml={listing.data.readmeHtml} />}
    </>
  ));
};
