import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { Readme } from '@metorial/markdown';
import { useCurrentInstance, useProvider, useProviderListing } from '@metorial/state';
import { Attributes, Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';

export let ProviderReadmePage = () => {
  let instance = useCurrentInstance();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let listing = useProviderListing(instance.data?.id, providerId);

  return renderWithLoader({ provider })(({ provider }) => (
    <>
      <SideBox
        title="Test this provider"
        description="Use the Metorial Explorer to test this provider."
      >
        <Link
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { provider_id: provider.data?.id }
          )}
        >
          <Button as="span" size="2">
            Open Explorer
          </Button>
        </Link>
      </SideBox>

      <Spacer height={15} />

      <Attributes
        attributes={[
          {
            label: 'Provider',
            content: provider.data.name
          },
          {
            label: 'Slug',
            content: provider.data.slug
          },
          {
            label: 'Provider ID',
            content: <ID id={provider.data.id} />
          }
        ]}
      />

      <Spacer height={15} />

      {listing.data?.readme ? (
        <Readme readme={listing.data.readme} />
      ) : (
        <Text size="2" color="gray600">
          No readme available for this provider.
        </Text>
      )}
    </>
  ));
};
