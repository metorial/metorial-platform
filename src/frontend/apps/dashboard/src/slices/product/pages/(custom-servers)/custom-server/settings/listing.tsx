import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCustomServer,
  useCustomServerListing,
  useCustomServerVersion,
  useDashboardFlags
} from '@metorial/state';
import { Button, confirm, Input, Switch } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TextEditor } from '../../../../components/editor';
import { FormBox } from '../../../../scenes/form/box';
import { Field } from '../../../../scenes/form/field';
import { FormPage } from '../../../../scenes/form/page';

export let CustomServerListingPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let listing = useCustomServerListing(instance.data?.id, customServer.data?.id);
  let version = useCustomServerVersion(
    instance.data?.id,
    customServer.data?.id,
    customServer.data?.currentVersionId
  );

  let statusUpdate = listing.useUpdateMutator();
  let generalUpdate = listing.useUpdateMutator();
  let readmeUpdate = listing.useUpdateMutator();

  let [isPublic, setIsPublic] = useState(false);
  useEffect(
    () => setIsPublic(customServer.data?.publicationStatus == 'public'),
    [customServer.data?.publicationStatus]
  );

  let implementation =
    version.data?.serverInstance.managedServer ?? version.data?.serverInstance.remoteServer;

  let flags = useDashboardFlags();
  if (!flags.data?.flags['community-profiles-enabled']) return;

  return renderWithLoader({ customServer, listing })(({ customServer, listing }) => (
    <FormPage>
      <Box
        title="Publish Custom Server"
        description="Make this custom server available for deployments."
      >
        <Switch
          label="Publish custom server for all Metorial users to use."
          disabled={
            statusUpdate.isLoading || generalUpdate.isLoading || readmeUpdate.isLoading
          }
          checked={isPublic}
          onCheckedChange={async checked => {
            if (checked) {
              setIsPublic(checked);

              confirm({
                title: 'Are you sure you want to publish this custom server?',
                description:
                  'This will make the custom server available for all Metorial users to use. This might expose sensitive information, so make sure you understand the implications.',
                onConfirm: () => {
                  statusUpdate.mutate({
                    status: 'public'
                  });
                },
                onCancel: () => {
                  setIsPublic(false);
                }
              });
            } else {
              statusUpdate.mutate({
                status: 'private'
              });
            }
          }}
        />
      </Box>

      {customServer.data.publicationStatus == 'public' && (
        <>
          <Box
            title="Open Server Listing"
            description="View this custom server listing in the Metorial catalog."
          >
            <Link
              to={Paths.instance.server(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                customServer.data.server.id
              )}
            >
              <Button as="span" size="2" variant="outline">
                Open Listing
              </Button>
            </Link>
          </Box>

          <FormBox
            title="Listing"
            description="Update how this server is listed in the Metorial catalog."
            schema={yup =>
              yup.object({
                name: yup.string().optional(),
                description: yup.string().optional()
              })
            }
            initialValues={{
              name: listing.data?.name ?? customServer.data?.name ?? '',
              description: listing.data?.description ?? customServer.data?.description ?? ''
            }}
            mutators={[generalUpdate]}
            onSubmit={async values => {
              if (!instance.data) return;

              await generalUpdate.mutate({
                status: 'public',
                name: values.name,
                description: values.description
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

          <FormBox
            title="Readme"
            description="Update the readme for this custom server listing."
            schema={yup =>
              yup.object({
                readme: yup.string().optional()
              })
            }
            initialValues={{
              readme: listing.data?.readme ?? ''
            }}
            mutators={[readmeUpdate]}
            onSubmit={async values => {
              if (!instance.data) return;

              await readmeUpdate.mutate({
                status: 'public',
                readme: values.readme
              });
            }}
          >
            <Field field="readme">
              {({ value, setValue }) => (
                <TextEditor
                  content={value}
                  onChange={content => {
                    setValue(content);
                  }}
                  placeholder="Write a readme for this custom server..."
                />
              )}
            </Field>
          </FormBox>

          {implementation?.providerOauth && (
            <FormBox
              title="OAuth Explainer"
              description="Explain how to set up OAuth for this custom server."
              schema={yup =>
                yup.object({
                  oauthExplainer: yup.string().optional()
                })
              }
              initialValues={{
                oauthExplainer: listing.data?.oauthExplainer ?? ''
              }}
              mutators={[readmeUpdate]}
              onSubmit={async values => {
                if (!instance.data) return;

                await readmeUpdate.mutate({
                  status: 'public',
                  oauthExplainer: values.oauthExplainer
                });
              }}
            >
              <Field field="oauthExplainer">
                {({ value, setValue }) => (
                  <TextEditor
                    content={value}
                    onChange={content => {
                      setValue(content);
                    }}
                    placeholder={`Explain how to set up OAuth for this custom server...`}
                  />
                )}
              </Field>
            </FormBox>
          )}
        </>
      )}
    </FormPage>
  ));
};
