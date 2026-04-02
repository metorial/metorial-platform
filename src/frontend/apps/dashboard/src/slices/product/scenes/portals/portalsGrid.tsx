import { DashboardInstancePortalsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreatePortal, useCurrentInstance, usePortals } from '@metorial/state';
import { Avatar, Button, Dialog, Input, Spacer, showModal, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

let Aliases = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let Alias = styled.div`
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let moveDots = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 18px 18px;
  }
`;

let EmptyState = styled.div`
  position: relative;
  background: ${theme.colors.gray100};
  background-image: radial-gradient(${theme.colors.gray400} 1px, transparent 0);
  background-size: 18px 18px;
  background-position: -10px -10px;
  animation: ${moveDots} 2s linear infinite;
  min-height: 520px;
  border-radius: 16px;
  border: 1px solid ${theme.colors.gray300};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  text-align: center;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle,
      transparent calc(100% - 260px),
      ${theme.colors.gray100} 100%
    );
    pointer-events: none;
  }
`;

let EmptyTitle = styled.h1`
  color: ${theme.colors.foreground};
  font-size: 32px;
  font-weight: 700;
  margin: 20px 0 16px;
  position: relative;
  z-index: 1;
`;

let EmptyDescription = styled('p')`
  max-width: 700px;
  position: relative;
  z-index: 1;
  text-wrap: balance;
  text-align: center;
  font-size: 14px;
  color: ${theme.colors.gray700};
  font-weight: 500;
`;

export let showPortalFormModal = (props: { instanceId: string; onCreate?: () => void }) =>
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

        props.onCreate?.();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Portal</Dialog.Title>
        <Dialog.Description>
          Create a branded provider catalog for this instance.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          {/* <Spacer size={15} />

          <Input
            label="Session Expiry (seconds)"
            type="number"
            {...form.getFieldProps('sessionExpiryTimeInSeconds')}
          />
          <form.RenderError field="sessionExpiryTimeInSeconds" /> */}

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

export let PortalsGrid = (filter: DashboardInstancePortalsListQuery) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let portals = usePortals(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(portals, {
    hidePaginationWhenUnavailable: true
  })(portalsPage => {
    if (portalsPage.data.items.length === 0) {
      return (
        <EmptyState>
          <EmptyTitle>Metorial Portals</EmptyTitle>
          <EmptyDescription>
            Portals let you present a branded provider catalog with curated access, reusable
            templates, and self-service request flows for your consumers.
          </EmptyDescription>

          <Spacer size={30} />

          <Button
            onClick={() =>
              instance.data &&
              showPortalFormModal({
                instanceId: instance.data.id,
                onCreate: () => portals.refetch()
              })
            }
          >
            Create Portal
          </Button>
        </EmptyState>
      );
    }

    return (
      <ItemGrid.Root width="320px">
        {portalsPage.data.items.map(portal => (
          <ItemGrid.Item
            key={portal.id}
            entity={{ id: portal.id }}
            title={portal.name || 'Untitled Portal'}
            description={
              portal.description
                ? portal.description.slice(0, 110) +
                  (portal.description.length > 110 ? '...' : '')
                : 'No description'
            }
            height={250}
            icon={
              <Avatar
                entity={{
                  ...portal,
                  imageUrl: `https://avatar-cdn.metorial.com/${portal.id}`
                }}
                size={30}
              />
            }
            onClick={() =>
              navigate(
                Paths.instance.portal(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  portal.id
                )
              )
            }
            bottom={
              <Aliases>
                {(portal.urls.length ? portal.urls : [{ url: 'No URL configured' }]).map(
                  (item, i) => (
                    <Alias key={i}>{item.url}</Alias>
                  )
                )}
              </Aliases>
            }
          />
        ))}
      </ItemGrid.Root>
    );
  });
};
