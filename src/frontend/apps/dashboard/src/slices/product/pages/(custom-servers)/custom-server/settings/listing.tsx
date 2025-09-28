import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer, useCustomServerListing } from '@metorial/state';
import { confirm, Input, Switch } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormBox } from '../../../../scenes/form/box';
import { Field } from '../../../../scenes/form/field';
import { FormPage } from '../../../../scenes/form/page';

export let CustomServerListingPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let listing = useCustomServerListing(instance.data?.id, customServer.data?.id);
  let update = listing.useUpdateMutator();

  let [isPublic, setIsPublic] = useState(false);
  useEffect(
    () => setIsPublic(customServer.data?.publicationStatus == 'public'),
    [customServer.data?.publicationStatus]
  );

  return renderWithLoader({ customServer, listing })(({ customServer, listing }) => (
    <FormPage>
      <Box
        title="Publish Custom Server"
        description="Make this custom server available for deployments."
      >
        <Switch
          label="Publish custom server for all Metorial users to use."
          disabled={update.isLoading}
          checked={isPublic}
          onCheckedChange={async checked => {
            if (checked) {
              setIsPublic(checked);

              confirm({
                title: 'Are you sure you want to publish this custom server?',
                description:
                  'This will make the custom server available for all Metorial users to use. This might expose sensitive information, so make sure you understand the implications.',
                onConfirm: () => {
                  update.mutate({
                    status: 'public'
                  });
                },
                onCancel: () => {
                  setIsPublic(false);
                }
              });
            } else {
              update.mutate({
                status: 'private'
              });
            }
          }}
        />
      </Box>

      {customServer.data.publicationStatus == 'public' && (
        <>
          <FormBox
            title="Listing"
            description="Update how this server is listed in the Metorial catalog."
            schema={yup =>
              yup.object({
                name: yup.string().optional(),
                description: yup.string().optional(),
                readme: yup.string().optional()
              })
            }
            initialValues={{
              name: listing.data?.name ?? customServer.data?.name ?? '',
              description: listing.data?.description ?? customServer.data?.description ?? ''
            }}
            mutators={[update]}
            onSubmit={async values => {
              if (!instance.data) return;

              await update.mutate({
                status: 'public',
                name: values.name,
                description: values.description,
                readme: values.readme
              });
            }}
          >
            <Field field="name">
              {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
            </Field>

            <Field field="description">
              {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
            </Field>
          </FormBox>
        </>
      )}
    </FormPage>
  ));
};
