import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackDestination,
  useCallbackDestinations,
  useCreateCallbackDestination,
  useCurrentInstance,
  useServerDeployment
} from '@metorial/state';
import {
  Attributes,
  Button,
  Copy,
  Dialog,
  Flex,
  Input,
  Menu,
  Panel,
  RenderDate,
  showModal,
  Spacer,
  Text,
  Title
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../../../../scenes/routerPanel';
import { Notifications } from './logs';

export let CallbackDestinationsPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);
  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);
  let destinations = useCallbackDestinations(instance.data?.id, {
    callbackIds: callback.data?.id
  });
  let deleteMutator = destinations.useDeleteMutator();

  let [_, setSearchParams] = useSearchParams();

  return (
    <>
      <Flex gap="30px">
        <div>
          <Title as="h2" size="5" weight="strong">
            Destinations
          </Title>
          <Text size="2" weight="medium" color="gray600">
            Destinations are endpoints where you will receive a request when a Metorial
            callback is triggered.
          </Text>
        </div>

        <Button
          iconRight={<RiAddLine />}
          size="2"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let create = useCreateCallbackDestination();

              let form = useForm({
                initialValues: {
                  name: '',
                  description: '',
                  url: ''
                },
                schema: yup =>
                  yup.object({
                    name: yup.string().required('Enter a name'),
                    description: yup.string(),
                    url: yup.string().url('Enter a valid URL').required('Enter a URL')
                  }),
                onSubmit: async values => {
                  let [res] = await create.mutate({
                    instanceId: instance.data?.id!,
                    name: values.name,
                    description: values.description,
                    url: values.url,
                    callbacks: {
                      type: 'selected',
                      callbackIds: [callback.data?.id!]
                    }
                  });
                  if (res) close();
                }
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Create Destination</Dialog.Title>
                  <Dialog.Description>
                    Destinations allow you to receive callbacks from Metorial.
                  </Dialog.Description>

                  <form onSubmit={form.handleSubmit}>
                    <Input label="Name" {...form.getFieldProps('name')} />
                    <form.RenderError field="name" />

                    <Spacer height={15} />

                    <Input label="Description" {...form.getFieldProps('description')} />
                    <form.RenderError field="description" />

                    <Spacer height={15} />

                    <Input label="URL" {...form.getFieldProps('url')} />
                    <form.RenderError field="url" />

                    <Spacer height={25} />

                    <Button
                      loading={create.isLoading}
                      success={create.isSuccess}
                      type="submit"
                    >
                      Create Destination
                    </Button>
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Create Destination
        </Button>
      </Flex>
      <Spacer height={20} />

      {renderWithPagination(destinations)(destinations => (
        <>
          <Table
            headers={['Info', 'URL', 'Created', '']}
            data={destinations.data.items.map(destination => ({
              data: [
                <Flex gap={3} direction="column">
                  <Text size="2" weight="strong">
                    {destination.name}
                  </Text>
                  <Text size="1" color="gray600" truncate>
                    {destination.description}
                  </Text>
                </Flex>,
                destination.webhookDestination?.url,
                <RenderDate date={destination.createdAt} />,
                <div
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <Menu
                    items={[{ id: 'delete', label: 'Delete' }]}
                    onItemClick={id => {
                      if (id == 'delete')
                        deleteMutator.mutate({ destinationId: destination.id });
                    }}
                  >
                    <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
                  </Menu>
                </div>
              ],
              onClick: () =>
                setSearchParams(p => {
                  p.set('destination_id', destination.id);
                  return p;
                })
            }))}
          />

          {destinations.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No destinations for this callback.
            </Text>
          )}
        </>
      ))}

      <RouterPanel param="destination_id" width={1000}>
        {destinationId => (
          <>
            <Panel.Header>
              <Panel.Title>Destination Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Destination destinationId={destinationId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Destination = ({ destinationId }: { destinationId: string }) => {
  let instance = useCurrentInstance();
  let destination = useCallbackDestination(instance.data?.id, destinationId);

  return renderWithLoader({ destination })(({ destination }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={destination.data.id} />
          },
          {
            label: 'URL',
            content: destination.data.webhookDestination?.url
          },
          {
            label: 'Created At',
            content: <RenderDate date={destination.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      <Box
        title="Signing Secret"
        description="Metorial uses this secret to sign webhook requests sent to this destination."
      >
        <Copy value={destination.data?.webhookDestination?.signingSecret ?? ''} />
      </Box>

      <Spacer height={15} />

      <Box
        title="Recent Logs"
        description="View recent notifications sent to this destination."
      >
        <Notifications destinationIds={destination.data?.id} />
      </Box>
    </>
  ));
};
