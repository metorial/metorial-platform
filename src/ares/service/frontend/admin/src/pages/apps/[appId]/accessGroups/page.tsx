import { renderWithLoader, useForm, useMutation } from '@metorial-io/data-hooks';
import { Button, Dialog, Input, showModal, Spacer, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { Link, useParams } from 'react-router-dom';
import { accessGroupsState } from '../../../../state';
import { adminClient } from '../../../../state/client';

export let AccessGroupsPage = () => {
  let { appId } = useParams();
  let accessGroups = accessGroupsState.use({ appId: appId! });
  let accessGroupRoot = accessGroups;

  return renderWithLoader({ accessGroups })(({ accessGroups }) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Title weight="strong" as="h1" size="7">
          Access Groups
        </Title>

        <Link to={`/apps/${appId}`}>
          <Button as="span" size="1" variant="outline">
            Back to App
          </Button>
        </Link>
      </div>

      <div style={{ marginBottom: 15 }}>
        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let create = useMutation(adminClient.accessGroup.create);

              let form = useForm({
                initialValues: { name: '' },
                onSubmit: async values => {
                  let [res] = await create.mutate({
                    appId: appId!,
                    name: values.name,
                    rules: []
                  });
                  if (res) {
                    close();
                    accessGroupRoot.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    name: yup.string().required('Name is required')
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Create Access Group</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Input label="Name" {...form.getFieldProps('name')} />
                    <form.RenderError field="name" />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={create.isLoading}
                      success={create.isSuccess}
                    >
                      Create
                    </Button>
                    <create.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Create Access Group
        </Button>
      </div>

      <Table
        headers={['Name', 'Rules', 'Created At', '']}
        data={accessGroups.data.items.map((group: any) => [
          group.name,
          group.counts.rules,
          new Date(group.createdAt).toLocaleDateString('de-at'),
          <AccessGroupActions
            group={group}
            appId={appId!}
            onUpdate={() => accessGroupRoot.refetch()}
          />
        ])}
      />
    </>
  ));
};

let AccessGroupActions = ({
  group,
  appId,
  onUpdate
}: {
  group: any;
  appId: string;
  onUpdate: () => void;
}) => {
  let deleteGroup = useMutation(adminClient.accessGroup.delete);

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <Link to={`/apps/${appId}/access-groups/${group.id}`}>
        <Button as="span" size="1">
          View
        </Button>
      </Link>
      <Button
        size="1"
        variant="outline"
        loading={deleteGroup.isLoading}
        onClick={async () => {
          if (!confirm('Delete this access group?')) return;
          await deleteGroup.mutate({ id: group.id });
          onUpdate();
        }}
      >
        Delete
      </Button>
    </div>
  );
};
