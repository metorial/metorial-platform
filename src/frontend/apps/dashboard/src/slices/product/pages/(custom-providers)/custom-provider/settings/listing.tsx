import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderListing,
  useDashboardFlags
} from '@metorial/state';
import { Button, Input } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { FormBox } from '../../../../scenes/form/box';
import { Field } from '../../../../scenes/form/field';
import { FormPage } from '../../../../scenes/form/page';

export let CustomProviderListingPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);

  let listing = useCustomProviderListing(instance.data?.id, customServer.data?.id);

  let generalUpdate = listing.useUpdateMutator();

  let flags = useDashboardFlags();
  if (!flags.data?.flags['community-profiles-enabled']) return;

  return renderWithLoader({ customServer, listing })(({ customServer, listing }) => (
    <FormPage>
      {/* <Box
        title="Publish Provider"
        description="Make this provider available for deployments."
      >
        <Switch
          label="Publish provider for all Metorial users to use."
          disabled={publicationUpdate.isLoading || generalUpdate.isLoading}
          checked={isPublic}
          onCheckedChange={async checked => {
            if (checked) {
              setIsPublic(true);

              confirm({
                title: 'Are you sure you want to publish this provider?',
                description:
                  'This will make the provider available for all Metorial users to use. This might expose sensitive information, so make sure you understand the implications.',
                onConfirm: async () => {
                  await publicationUpdate.mutate({
                    access: 'public'
                  });
                },
                onCancel: () => {
                  setIsPublic(false);
                }
              });
              return;
            }

            setIsPublic(false);
            await publicationUpdate.mutate({
              access: 'tenant'
            });
          }}
        />
      </Box> */}

      <Box
        title="Open Provider Listing"
        description="View this provider listing in the Metorial catalog."
      >
        <Link
          to={Paths.instance.provider(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            customServer.data.provider?.id ?? customServer.data.id
          )}
        >
          <Button as="span" size="2" variant="outline">
            Open Listing
          </Button>
        </Link>
      </Box>

      <FormBox
        title="Listing"
        description="Update how this provider is listed in the Metorial catalog."
        schema={yup =>
          yup.object({
            name: yup.string().optional(),
            description: yup.string().optional(),
            readme: yup.string().optional()
          })
        }
        initialValues={{
          name: listing.data?.name ?? customServer.data?.name ?? '',
          description: listing.data?.description ?? customServer.data?.description ?? '',
          readme: listing.data?.readme ?? ''
        }}
        mutators={[generalUpdate]}
        onSubmit={async values => {
          if (!instance.data) return;

          await generalUpdate.mutate({
            name: values.name,
            description: values.description,
            readme: values.readme || undefined
          });
        }}
      >
        <Field field="name">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
        </Field>

        <Field field="description">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
        </Field>

        <Field field="readme">
          {({ getFieldProps }) => (
            <Input {...getFieldProps()} label="Readme" as="textarea" />
          )}
        </Field>
      </FormBox>

    </FormPage>
  ));
};
