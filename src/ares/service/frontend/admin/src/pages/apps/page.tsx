import { renderWithLoader, useForm, useMutation } from '@metorial-io/data-hooks';
import { Button, Checkbox, Dialog, Input, showModal, Spacer } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appsState } from '../../state';
import { adminClient } from '../../state/client';

export let AppsPage = () => {
  let [after, setAfter] = useState<string | undefined>();
  let [search, setSearch] = useState<string | undefined>();
  let navigate = useNavigate();

  let apps = appsState.use({ search, after });

  return renderWithLoader({ apps })(({ apps }) => (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <form
          style={{ flex: 1 }}
          onSubmit={e => {
            e.preventDefault();
            let formData = new FormData(e.target as HTMLFormElement);
            setSearch(formData.get('search') as string);
          }}
        >
          <Input
            label="Search"
            hideLabel
            placeholder="Search"
            name="search"
            defaultValue={search}
          />
        </form>

        <Button
          size="2"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let create = useMutation(adminClient.app.create);

              let form = useForm({
                initialValues: {
                  defaultRedirectUrl: '',
                  slug: '',
                  isSessionless: false,
                  disableEmailAuth: false
                },
                onSubmit: async values => {
                  let [res] = await create.mutate({
                    defaultRedirectUrl: values.defaultRedirectUrl,
                    slug: values.slug || undefined,
                    isSessionless: values.isSessionless,
                    disableEmailAuth: values.disableEmailAuth
                  });
                  if (res) {
                    close();
                    navigate(`/apps/${res.id}`);
                  }
                },
                schema: yup =>
                  yup.object({
                    defaultRedirectUrl: yup.string().url().required(),
                    slug: yup.string(),
                    isSessionless: yup.boolean(),
                    disableEmailAuth: yup.boolean()
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Create App</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Input
                      label="Default Redirect URL"
                      {...form.getFieldProps('defaultRedirectUrl')}
                    />
                    <form.RenderError field="defaultRedirectUrl" />

                    <Spacer size={15} />

                    <Input label="Slug (optional)" {...form.getFieldProps('slug')} />
                    <form.RenderError field="slug" />

                    <Spacer size={15} />

                    <Checkbox
                      checked={form.values.isSessionless}
                      onCheckedChange={v => form.setFieldValue('isSessionless', v)}
                      label="Sessionless app"
                    />

                    <Spacer size={15} />

                    <Checkbox
                      checked={form.values.disableEmailAuth}
                      onCheckedChange={v => form.setFieldValue('disableEmailAuth', v)}
                      label="Disable email authentication"
                    />

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
          Create App
        </Button>
      </div>

      <Table
        headers={['Client ID', 'Slug', 'Users', 'Tenants', 'Created At', '']}
        data={apps.data.items.map((app: any) => ({
          data: [
            app.clientId,
            app.slug ?? '-',
            app.counts.users,
            app.counts.tenants,
            new Date(app.createdAt).toLocaleDateString('de-at'),
            <Button as="span" size="1">
              View
            </Button>
          ],
          href: `/apps/${app.id}`
        }))}
      />

      {apps.data.items.length > 0 && (
        <Button
          size="1"
          style={{ marginTop: 20 }}
          onClick={() => setAfter(apps.data.items[apps.data.items.length - 1]?.id)}
        >
          Load More
        </Button>
      )}
    </>
  ));
};
