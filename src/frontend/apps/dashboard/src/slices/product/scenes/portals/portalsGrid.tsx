import { DashboardInstancePortalsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreatePortal, useCurrentInstance, usePortals } from '@metorial/state';
import { Avatar, Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

let Aliases = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let Alias = styled.div`
  background: #f0f0f0;
  height: 26px;
  border-radius: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
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
  background: #eee;
  background-image: radial-gradient(#bbb 1px, transparent 0);
  background-size: 18px 18px;
  background-position: -10px -10px;
  animation: ${moveDots} 2s linear infinite;

  height: 600px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(220, 220, 220, 0.1);

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
      transparent calc(100% - 300px),
      rgba(220, 220, 220, 1) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  h1 {
    color: #222;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 30px;
    margin-top: 20px;
    z-index: 2;
    position: relative;
  }

  p {
    color: #777;
    font-size: 18px;
    font-weight: 500;
    max-width: 620px;
    z-index: 2;
    line-height: 1.5;
    letter-spacing: 1px;
    position: relative;
    text-wrap: balance;
  }
`;

export let PortalsGrid = (filter: DashboardInstancePortalsListQuery) => {
  let instance = useCurrentInstance();
  let portals = usePortals(instance.data?.instanceId, {
    ...filter,
    order: filter.order ?? 'desc'
  });
  let navigate = useNavigate();

  return renderWithLoader({ portals })(({ portals }) => (
    <>
      {portals.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {portals.data.items.map(portal => (
            <ItemGrid.Item
              key={portal.id}
              entity={{ id: portal.id, hasUsage: true }}
              title={portal.name ?? 'Unknown Server'}
              description={
                portal.description?.slice(0, 100) +
                (portal.description && portal.description.length > 100 ? '...' : '')
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
                  {portal.urls.map((e, i) => (
                    <Alias key={i}>{e.url}</Alias>
                  ))}
                </Aliases>
              }
            />
          ))}
        </ItemGrid.Root>
      )}

      {portals.data.items.length == 0 && (
        <>
          <EmptyState>
            <h1>Metorial Portals</h1>
            <p>
              Portals allow you to create a custom branded MCP server marketplace for your
              organization. Complete with access control, self-serve server deployment, and
              more.
            </p>

            <Spacer size={30} />

            <Button onClick={() => showPortalFormModal()}>Create Portal</Button>
          </EmptyState>
        </>
      )}
    </>
  ));
};

export let showPortalFormModal = () =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreatePortal();
    let instance = useCurrentInstance();

    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          name: values.name,
          description: values.description,
          instanceId: instance.data!.instanceId
        });

        if (res) setTimeout(() => close(), 500);
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Portal</Dialog.Title>
        <Dialog.Description>
          Use Portals to create custom branded MCP server marketplaces for your
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Dialog.Actions>
            <Button size="1" variant="soft" onClick={close} type="button">
              Cancel
            </Button>
            <Button
              size="1"
              type="submit"
              loading={mutator.isLoading}
              success={mutator.isSuccess}
            >
              Create
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
