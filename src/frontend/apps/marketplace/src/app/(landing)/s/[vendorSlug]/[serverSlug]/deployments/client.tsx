'use client';

import {
  Button,
  confirm,
  Dialog,
  Entity,
  Input,
  Menu,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { RiMore2Line } from '@remixicon/react';
import styled from 'styled-components';
import { useForm } from '../../../../../../hooks/use-form';
import { renderLoader } from '../../../../../../lib/loader';
import { useServerInstances } from '../../../../../../state/client/serverInstance';
import { FullServer } from '../../../../../../state/server';
import { openCreateServerInstanceModal } from '../components/deploy/createForm';
import { openServerInstanceUsageModal } from '../components/deploy/instanceUsage';
import { useExplorer } from '../components/explorer/context';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let DeploymentPageClient = ({ server }: { server?: FullServer }) => {
  let instances = useServerInstances(server);
  let explorer = useExplorer(server);

  let deleteInstance = instances.deleteServerInstance;
  let updateInstance = instances.updateServerInstance;

  return renderLoader(instances)(data => (
    <Wrapper>
      {data.items.length === 0 && <Text>You haven't deployed this server yet.</Text>}

      {data.items.map(instance => (
        <Entity.Wrapper key={instance.id}>
          <Entity.Content>
            <Entity.Field
              title={instance.name}
              value={instance.description || instance.server.full_slug}
            />

            <Entity.Field title="Actions" right>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}
              >
                <Button size="1" onClick={() => openServerInstanceUsageModal(instance)}>
                  Use Server
                </Button>

                <Menu
                  items={[
                    { label: 'Open in Explorer', id: 'explorer' },
                    { label: 'Delete', id: 'delete' },
                    { label: 'Update', id: 'update' }
                  ]}
                  onItemClick={id => {
                    if (id === 'explorer') explorer.open(instance);
                    if (id === 'delete') {
                      confirm({
                        title: 'Delete Server Instance',
                        description: `Are you sure you want to delete the server instance ${instance.name}? This action cannot be undone.`,
                        confirmText: 'Delete',
                        onConfirm: () => {
                          deleteInstance.mutate(instance.id);
                        }
                      });
                    }

                    if (id === 'update') {
                      showModal(({ dialogProps, close }) => {
                        let form = useForm({
                          initialValues: {
                            name: instance.name,
                            description: instance.description ?? ''
                          },
                          schema: yup =>
                            yup.object({
                              name: yup.string().required('Name is required'),
                              description: yup.string()
                            }),
                          onSubmit: async (values, ctx) => {
                            form.setSubmitting(true);

                            updateInstance
                              .mutateAsync({
                                serverInstanceId: instance.id,
                                name: values.name
                              })
                              .then(() => close())
                              .catch(err => {
                                ctx.setSubmitting(false);
                              });
                          }
                        });

                        return (
                          <Dialog.Wrapper {...dialogProps}>
                            <Dialog.Title>Update Server Instance</Dialog.Title>

                            <form onSubmit={form.handleSubmit}>
                              <Input
                                label="Name"
                                placeholder="Server Instance Name"
                                {...form.getFieldProps('name')}
                              />
                              <form.RenderError field="name" />

                              <Spacer size={10} />

                              <Input
                                label="Description"
                                placeholder="Server Instance Description"
                                {...form.getFieldProps('description')}
                              />
                              <form.RenderError field="description" />
                              <Spacer size={20} />

                              <Button type="submit" loading={form.isSubmitting}>
                                Update
                              </Button>
                            </form>
                          </Dialog.Wrapper>
                        );
                      });
                    }
                  }}
                >
                  <Button size="1" iconRight={<RiMore2Line />} />
                </Menu>
              </div>
            </Entity.Field>
          </Entity.Content>
        </Entity.Wrapper>
      ))}

      {server && (
        <div>
          <Button onClick={() => openCreateServerInstanceModal(server)}>Deploy Server</Button>
        </div>
      )}
    </Wrapper>
  ));
};
