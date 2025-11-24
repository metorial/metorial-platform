import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout/src/components/content';
import { PageHeader } from '@metorial/layout/src/components/header';
import { Button, Copy, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { MagicMcpTokensTable } from '../../../../scenes/magicMcp/tokensTable';
import { useCreateMagicMcpToken } from '../../../../state/consumer/magicMcpToken';

export let MagicMcpTokensPage = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP Tokens"
        description="Magic MCP tokens allow secure access to your Magic MCP servers."
        actions={
          <Button size="2" onClick={() => createMagicMcpTokenModal()}>
            Create Magic MCP Token
          </Button>
        }
      />

      {renderWithLoader({})(({}) => (
        <MagicMcpTokensTable />
      ))}
    </ContentLayout>
  );
};

export let createMagicMcpTokenModal = () =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreateMagicMcpToken();

    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          name: values.name,
          description: values.description
        });

        if (res) {
          close();

          setTimeout(() => {
            if (res && res.secret) {
              showModal(({ dialogProps, close }) => {
                return (
                  <Dialog.Wrapper variant="padded" {...dialogProps}>
                    <Dialog.Title>Magic MCP Token Created</Dialog.Title>
                    <Dialog.Description>
                      Your new Magic MCP token is ready to use. Please don't share it with
                      anyone and keep it in a safe place, such as a password manager.
                    </Dialog.Description>

                    <Copy label="Magic MCP Token" value={res.secret ?? '...'} />

                    <Spacer height={15} />

                    <Dialog.Actions>
                      <Button onClick={close}>Close</Button>
                    </Dialog.Actions>
                  </Dialog.Wrapper>
                );
              });
            }
          }, 100);
        }
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Magic MCP Token</Dialog.Title>
        <Dialog.Description>
          Create a new Magic MCP token to connect to Magic MCP servers.
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
            <Button size="1" type="submit">
              Create
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
