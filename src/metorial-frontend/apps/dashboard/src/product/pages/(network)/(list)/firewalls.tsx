import { DashboardInstanceFirewallsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, lifecycleStatus } from '@metorial/data-list';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreateFirewall, useFirewalls } from '@metorial/state';
import { Button, Dialog, Input, Spacer, showModal } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { useNetworkManagementAccess } from '../_gate';

type Firewall = DashboardInstanceFirewallsListOutput['items'][number];

let FirewallsList = createDataList('network-firewalls')
  .context(useInstanceContext)
  .search('Search firewalls…')
  .paginated(({ ctx, search }) => useFirewalls(ctx.instanceId, { order: 'desc', search }))
  .columns([
    col.name<Firewall>(),
    col.status<Firewall, 'active' | 'archived' | 'deleted'>(lifecycleStatus, {
      isDefault: false
    }),
    col.count<Firewall>('policies', firewall => firewall.networkPolicies.length, 'policy', {
      header: 'Policies',
      isDefault: false
    }),
    col.updatedAt<Firewall>({ isDefault: true }),
    col.id<Firewall>({ isDefault: true })
  ])
  .link((firewall, _props, ctx) =>
    Paths.instance.networkFirewall(ctx.organization, ctx.project, ctx.instance, firewall.id)
  )
  .build();

let FirewallsTable = () => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();
  let { canWrite } = useNetworkManagementAccess();

  return (
    <FirewallsList
      emptyState="No firewalls configured."
      headerActions={() =>
        canWrite ? (
          <Button
            size="2"
            disabled={!ctx.instanceId}
            onClick={() => {
              if (!ctx.instanceId) return;

              showCreateFirewallModal({
                instanceId: ctx.instanceId,
                onCreate: firewallId =>
                  navigate(
                    Paths.instance.networkFirewall(
                      ctx.organization,
                      ctx.project,
                      ctx.instance,
                      firewallId
                    )
                  )
              });
            }}
          >
            Create Firewall
          </Button>
        ) : null
      }
    />
  );
};

let showCreateFirewallModal = (p: {
  instanceId: string;
  onCreate: (firewallId: string) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createFirewall = useCreateFirewall();
    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [firewall] = await createFirewall.mutate({
          instanceId: p.instanceId,
          name: values.name.trim(),
          description: values.description || undefined
        });

        if (!firewall) return;
        close();
        p.onCreate(firewall.id);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={620}>
        <Dialog.Title>Create Firewall</Dialog.Title>
        <Dialog.Description>Create a firewall on the default network.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="outline" size="2" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="2" loading={createFirewall.isLoading}>
              Create
            </Button>
          </div>
          <createFirewall.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

export let NetworkFirewallsPage = () => <FirewallsTable />;
