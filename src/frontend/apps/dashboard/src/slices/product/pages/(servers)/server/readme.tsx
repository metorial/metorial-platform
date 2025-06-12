import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { Readme } from '@metorial/markdown';
import { useCurrentInstance, useServer, useServerListing } from '@metorial/state';
import { Button, Callout, LinkButton, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { Skills } from './components/skills';

export let ServerReadmePage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let listing = useServerListing(serverId);

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

      <Skills skills={listing.data.skills} />

      <Spacer height={15} />

      <Readme
        readme={listing.data.readme}
        imageRoot={
          listing.data.repository
            ? `https://raw.githubusercontent.com/${listing.data.repository.identifier.replace('github.com/', '')}/${listing.data.repository.defaultBranch ?? 'main'}/`
            : undefined
        }
      />
    </>
  ));
};
