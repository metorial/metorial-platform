import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderListing,
  useProviderListingByProviderId
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { FormPage } from '../../../../scenes/form/page';

export let CustomProviderListingPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);

  let listing = useCustomProviderListing(instance.data?.id, customServer.data?.id);
  let providerListing = useProviderListingByProviderId(
    instance.data?.id,
    customServer.data?.provider?.id
  );

  let generalUpdate = listing.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: listing.data?.name ?? customServer.data?.name ?? '',
      description: listing.data?.description ?? customServer.data?.description ?? '',
      readme: providerListing.data?.readme ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;

      await generalUpdate.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        readme: values.readme.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure(),
        readme: yup.string().ensure()
      })
  });

  return renderWithLoader({ customServer, listing })(() => (
    <FormPage>
      <Box
        title="Open Provider Listing"
        description="View this provider listing in the Metorial catalog."
      >
        <Link
          to={Paths.instance.provider(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            customServer.data?.provider?.id ?? customServer.data?.id
          )}
        >
          <Button as="span" size="2" variant="outline">
            Open Listing
          </Button>
        </Link>
      </Box>

      <Box
        title="Listing"
        description="Update how this provider is listed in the Metorial catalog."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Input label="Readme" as="textarea" {...form.getFieldProps('readme')} />
          <form.RenderError field="readme" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={generalUpdate.isLoading}
              success={generalUpdate.isSuccess}
            >
              Save
            </Button>
          </div>

          <generalUpdate.RenderError />
        </form>
      </Box>
    </FormPage>
  ));
};
