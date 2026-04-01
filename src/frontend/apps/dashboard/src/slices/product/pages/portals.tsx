import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreatePortal,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortals
} from '@metorial/state';
import {
  Button,
  Dialog,
  Entity,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

let PortalList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let showCreatePortalModal = (props: {
  instanceId: string;
  onCreate: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createPortal = useCreatePortal();
    let form = useForm({
      initialValues: {
        name: '',
        description: '',
        sessionExpiryTimeInSeconds: '604800'
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string(),
          sessionExpiryTimeInSeconds: yup
            .number()
            .integer('Must be a whole number')
            .positive('Must be positive')
            .required('Session expiry is required')
        }),
      onSubmit: async values => {
        let [created] = await createPortal.mutate({
          instanceId: props.instanceId,
          name: values.name,
          description: values.description || undefined,
          sessionExpiryTimeInSeconds: Number(values.sessionExpiryTimeInSeconds)
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Portal</Dialog.Title>
        <Dialog.Description>
          Create a new branded portal for this instance.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Input
            label="Session Expiry (seconds)"
            {...form.getFieldProps('sessionExpiryTimeInSeconds')}
          />
          <form.RenderError field="sessionExpiryTimeInSeconds" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createPortal.isLoading}>
              Create Portal
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let portals = usePortals(instance.data?.id);

  return renderWithLoader({ instance, organization, project })(
    ({ instance, organization, project }) => (
      <ContentLayout>
        <PageHeader
          title="Portals"
          description="Manage the consumer-facing portals available for this instance."
          actions={
            <Button
              onClick={() =>
                showCreatePortalModal({
                  instanceId: instance.data.id,
                  onCreate: () => portals.refetch()
                })
              }
            >
              Create Portal
            </Button>
          }
        />

        {renderWithPagination(portals, {
          hidePaginationWhenUnavailable: true
        })(portals => (
          <PortalList>
            {portals.data.items.map(portal => (
              <Entity.Wrapper key={portal.id}>
                <Entity.Content>
                  <Entity.Field
                    title={portal.name}
                    value={portal.description ?? 'No description'}
                  />
                  <Entity.Field title="Slug" value={portal.slug} />
                  <Entity.Field title="Status" value={portal.status} />
                  <Entity.Field
                    title="URL"
                    value={portal.urls[0]?.url ?? 'No URL available'}
                  />
                  <Entity.Field
                    title="Created"
                    value={<RenderDate date={portal.createdAt} />}
                  />
                  <Entity.Field title="Actions" right>
                    <Link
                      to={Paths.instance.portal(
                        organization.data,
                        project.data,
                        instance.data,
                        portal.id
                      )}
                    >
                      <Button as="span" size="1" variant="outline">
                        Open
                      </Button>
                    </Link>
                  </Entity.Field>
                </Entity.Content>
              </Entity.Wrapper>
            ))}

            {portals.data.items.length === 0 && (
              <Text size="2" color="gray600">
                No portals exist for this instance yet.
              </Text>
            )}
          </PortalList>
        ))}
      </ContentLayout>
    )
  );
};
