import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeader } from '@metorial/layout';
import {
  useAttachNetworkPolicyToFirewall,
  useCreateNetworkPolicy,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDetachNetworkPolicyFromFirewall,
  useFirewall,
  useNetwork,
  useNetworkPolicy
} from '@metorial/state';
import { Attributes, Badge, Button, Dialog, Input, Menu, Select, Spacer, Text, showModal } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiArrowDownLine, RiArrowUpLine, RiMore2Line } from '@remixicon/react';
import { Link, useParams } from 'react-router-dom';
import { EmptyText, Stack } from '../_common';
import { useNetworkManagementAccess } from '../_gate';

type PolicyRuleInput = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[];
};

type PolicyRule = {
  id: string;
  object: 'network.policy.rule';
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description: string | null;
  enabled: boolean;
  priority: number;
  ports: ({ object: 'network.policy.port_range'; from: number; to: number }[] | null);
};

let cidrRegex =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:[0-9]|[12]\d|3[0-2])$/;

let parsePorts = (portFrom: string, portTo: string) =>
  portFrom !== '' && portTo !== '' ? [{ from: Number(portFrom), to: Number(portTo) }] : undefined;

let getRuleInput = (values: {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string;
  priority: string | number;
  portFrom: string;
  portTo: string;
  description: string;
}): PolicyRuleInput => ({
  effect: values.effect,
  direction: values.direction,
  cidrs: values.cidrs
    .split(',')
    .map(cidr => cidr.trim())
    .filter(Boolean),
  enabled: true,
  priority: Number(values.priority),
  description: values.description || undefined,
  ports: values.direction === 'egress' ? parsePorts(values.portFrom, values.portTo) : undefined
});

let Direction = ({ direction }: { direction: 'ingress' | 'egress' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    {direction === 'ingress' ? <RiArrowDownLine size={13} /> : <RiArrowUpLine size={13} />}
    {direction.toUpperCase()}
  </span>
);

let showCreatePolicyModal = (p: {
  instanceId: string;
  firewallId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createPolicy = useCreateNetworkPolicy();
    let attachPolicy = useAttachNetworkPolicyToFirewall();
    let form = useForm({
      initialValues: { name: '', description: '', cidrs: '0.0.0.0/0' },
      onSubmit: async values => {
        let [policy] = await createPolicy.mutate({
          instanceId: p.instanceId,
          name: values.name.trim(),
          description: values.description || undefined,
          rules: [
            {
              effect: 'allow',
              direction: 'egress',
              cidrs: values.cidrs
                .split(',')
                .map(cidr => cidr.trim())
                .filter(Boolean),
              enabled: true,
              priority: 100
            }
          ]
        });

        if (!policy) return;

        await attachPolicy.mutate({
          instanceId: p.instanceId,
          firewallId: p.firewallId,
          networkPolicyId: policy.id
        });
        close();
        p.onComplete();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string(),
          cidrs: yup
            .string()
            .trim()
            .required('At least one CIDR is required')
            .test('cidrs', 'Enter valid IPv4 CIDRs separated by commas', value => {
              let cidrs = (value ?? '')
                .split(',')
                .map(cidr => cidr.trim())
                .filter(Boolean);
              return cidrs.length > 0 && cidrs.every(cidr => cidrRegex.test(cidr));
            })
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>Create Network Policy</Dialog.Title>
        <Dialog.Description>
          Create a policy with an initial egress allow rule and attach it to this firewall.
        </Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={12} />
          <Input label="Allowed CIDRs" {...form.getFieldProps('cidrs')} />
          <form.RenderError field="cidrs" />
          <Spacer size={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="outline" size="2" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={createPolicy.isLoading || attachPolicy.isLoading}
            >
              Create
            </Button>
          </div>
          <createPolicy.RenderError />
          <attachPolicy.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

let showEditPolicyModal = (p: {
  name: string;
  description: string | null;
  onSubmit: (values: { name: string; description: string }) => Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let form = useForm({
      initialValues: {
        name: p.name,
        description: p.description ?? ''
      },
      onSubmit: async values => {
        await p.onSubmit({
          name: values.name.trim(),
          description: values.description
        });
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>Edit Network Policy</Dialog.Title>
        <Dialog.Description>Update the policy name and description.</Dialog.Description>

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
            <Button type="submit" size="2">
              Save
            </Button>
          </div>
        </form>
      </Dialog.Wrapper>
    );
  });

let showRuleModal = (p: {
  title: string;
  description: string;
  initialValues?: {
    effect: 'allow' | 'deny';
    direction: 'ingress' | 'egress';
    cidrs: string;
    priority: string;
    portFrom: string;
    portTo: string;
    description: string;
  };
  onSubmit: (rule: PolicyRuleInput) => Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let form = useForm({
      initialValues: p.initialValues ?? {
        effect: 'allow' as const,
        direction: 'egress' as const,
        cidrs: '0.0.0.0/0',
        priority: '100',
        portFrom: '',
        portTo: '',
        description: ''
      },
      onSubmit: async values => {
        await p.onSubmit(getRuleInput(values));
        close();
      },
      schema: yup =>
        yup.object({
          effect: yup.string().oneOf(['allow', 'deny']).required(),
          direction: yup.string().oneOf(['ingress', 'egress']).required(),
          cidrs: yup
            .string()
            .trim()
            .required('At least one CIDR is required')
            .test('cidrs', 'Enter valid IPv4 CIDRs separated by commas', value => {
              let cidrs = (value ?? '')
                .split(',')
                .map(cidr => cidr.trim())
                .filter(Boolean);
              return cidrs.length > 0 && cidrs.every(cidr => cidrRegex.test(cidr));
            }),
          priority: yup
            .number()
            .integer('Priority must be a whole number')
            .min(0, 'Priority must be 0 or higher')
            .required('Priority is required'),
          portFrom: yup
            .number()
            .integer('Port must be a whole number')
            .min(1, 'Port must be at least 1')
            .max(65535, 'Port must be 65535 or lower')
            .transform((value, originalValue) => (originalValue === '' ? undefined : value))
            .test('port-pair', 'Port From is required when Port To is set', function (value) {
              return this.parent.direction === 'ingress' || this.parent.portTo === undefined || value !== undefined;
            })
            .optional(),
          portTo: yup
            .number()
            .integer('Port must be a whole number')
            .min(1, 'Port must be at least 1')
            .max(65535, 'Port must be 65535 or lower')
            .transform((value, originalValue) => (originalValue === '' ? undefined : value))
            .test('port-pair', 'Port To is required when Port From is set', function (value) {
              return this.parent.direction === 'ingress' || this.parent.portFrom === undefined || value !== undefined;
            })
            .test('port-range', 'Port To must be greater than or equal to Port From', function (value) {
              return this.parent.direction === 'ingress' || this.parent.portFrom === undefined || value === undefined || value >= this.parent.portFrom;
            })
            .optional(),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>{p.title}</Dialog.Title>
        <Dialog.Description>{p.description}</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Select
            label="Effect"
            value={form.values.effect}
            onChange={value => form.setFieldValue('effect', value)}
            items={[
              { id: 'allow', label: 'Allow' },
              { id: 'deny', label: 'Deny' }
            ]}
          />
          <form.RenderError field="effect" />
          <Spacer size={12} />
          <Select
            label="Direction"
            value={form.values.direction}
            onChange={value => form.setFieldValue('direction', value)}
            items={[
              { id: 'egress', label: 'Egress' },
              { id: 'ingress', label: 'Ingress' }
            ]}
          />
          <form.RenderError field="direction" />
          <Spacer size={12} />
          <Input label="CIDRs" {...form.getFieldProps('cidrs')} />
          <form.RenderError field="cidrs" />
          <Spacer size={12} />
          <Input label="Priority" type="number" min={0} step={1} {...form.getFieldProps('priority')} />
          <form.RenderError field="priority" />
          {form.values.direction === 'egress' && (
            <>
              <Spacer size={12} />
              <Input label="Port From" type="number" min={1} max={65535} step={1} {...form.getFieldProps('portFrom')} />
              <form.RenderError field="portFrom" />
              <Spacer size={12} />
              <Input label="Port To" type="number" min={1} max={65535} step={1} {...form.getFieldProps('portTo')} />
              <form.RenderError field="portTo" />
            </>
          )}
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="outline" size="2" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="2">
              Save
            </Button>
          </div>
        </form>
      </Dialog.Wrapper>
    );
  });

let PolicyBox = (p: {
  instanceId: string;
  firewallId: string;
  policyId: string;
  onComplete: () => void;
  canWrite: boolean;
}) => {
  let policy = useNetworkPolicy(p.instanceId, p.policyId);
  let updatePolicy = policy.useUpdateMutator();
  let deleteRule = policy.useDeleteRuleMutator();
  let createRule = policy.useCreateRuleMutator();
  let updateRule = policy.useUpdateRuleMutator();
  let detachPolicy = useDetachNetworkPolicyFromFirewall();

  return renderWithLoader({ policy })(({ policy }) => (
    <Box
      title={policy.data.name}
      description={`Version ${policy.data.version}`}
      rightActions={
        p.canWrite ?
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="2"
              onClick={() =>
                showRuleModal({
                  title: 'Add Network Rule',
                  description: 'Add a rule to this network policy.',
                  initialValues: {
                    effect: 'allow',
                    direction: 'egress',
                    cidrs: '0.0.0.0/0',
                    priority: String(policy.data.rules.length + 100),
                    portFrom: '',
                    portTo: '',
                    description: ''
                  },
                  onSubmit: async rule => {
                    await createRule.mutate(rule);
                    p.onComplete();
                  }
                })
              }
            >
              Add Rule
            </Button>

            <Menu
            items={[
              { id: 'edit', label: 'Edit' },
              { id: 'detach', label: 'Detach' }
            ]}
            onItemClick={async item => {
              if (item === 'edit') {
                showEditPolicyModal({
                  name: policy.data.name,
                  description: policy.data.description,
                  onSubmit: async values => {
                    await updatePolicy.mutate({
                      name: values.name,
                      description: values.description || undefined
                    });
                    p.onComplete();
                  }
                });
              }

              if (item === 'detach') {
                await detachPolicy.mutate({
                  instanceId: p.instanceId,
                  firewallId: p.firewallId,
                  networkPolicyId: p.policyId
                });
                p.onComplete();
              }
            }}
          >
            <Button
              size="2"
              variant="outline"
              iconLeft={<RiMore2Line />}
              title="Policy actions"
            />
            </Menu>
          </div>
        : undefined
      }
    >
      {policy.data.rules.length > 0 ? (
        <Table
          headers={['Effect', 'Direction', 'CIDRs', 'Ports', 'Priority', '']}
          data={policy.data.rules.map((rule: PolicyRule) => ({
            data: [
              <Badge color={rule.effect === 'allow' ? 'green' : 'red'}>
                {rule.effect.toUpperCase()}
              </Badge>,
              <Direction direction={rule.direction} />,
              <Text size="2">{rule.cidrs.join(', ')}</Text>,
              <Text size="2">
                {rule.ports?.map(port => `${port.from}-${port.to}`).join(', ') ?? 'All'}
              </Text>,
              <Text size="2">{rule.priority}</Text>,
              p.canWrite ?
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <Menu
                    items={[
                      { id: 'edit', label: 'Edit' },
                      { id: 'remove', label: 'Remove' }
                    ]}
                    onItemClick={async item => {
                    if (item === 'edit') {
                      showRuleModal({
                        title: 'Edit Network Rule',
                        description: 'Update this network policy rule.',
                        initialValues: {
                          effect: rule.effect,
                          direction: rule.direction,
                          cidrs: rule.cidrs.join(', '),
                          priority: String(rule.priority),
                          portFrom: rule.ports?.[0] ? String(rule.ports[0].from) : '',
                          portTo: rule.ports?.[0] ? String(rule.ports[0].to) : '',
                          description: rule.description ?? ''
                        },
                        onSubmit: async nextRule => {
                          await updateRule.mutate({
                            ruleId: rule.id,
                            rule: nextRule,
                            currentRules: policy.data.rules.map((currentRule: PolicyRule) => ({
                              id: currentRule.id,
                              effect: currentRule.effect,
                              direction: currentRule.direction,
                              cidrs: currentRule.cidrs,
                              description: currentRule.description,
                              enabled: currentRule.enabled,
                              priority: currentRule.priority,
                              ports:
                                currentRule.ports?.map(port => ({
                                  from: port.from,
                                  to: port.to
                                })) ?? null
                            }))
                          });
                          p.onComplete();
                        }
                      });
                    }

                    if (item === 'remove') {
                      await deleteRule.mutate({ ruleId: rule.id });
                      p.onComplete();
                    }
                  }}
                >
                  <Button
                    size="1"
                    variant="outline"
                    iconLeft={<RiMore2Line />}
                    title="Rule actions"
                  />
                  </Menu>
                </div>
              : null
            ]
          }))}
        />
      ) : (
        <EmptyText>No rules in this policy.</EmptyText>
      )}
    </Box>
  ));
};

export let NetworkFirewallPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { firewallId } = useParams();
  let firewall = useFirewall(instance.data?.id, firewallId);
  let network = useNetwork(instance.data?.id, firewall.data?.networkId);
  let { canWrite } = useNetworkManagementAccess();

  return renderWithLoader({ firewall })(({ firewall }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={firewall.data.id} />
          },
          {
            label: 'Network',
            content: (
              <Link to={Paths.instance.network(organization.data, project.data, instance.data)}>
                {network.data?.name ?? 'Loading...'}
              </Link>
            )
          },
          {
            label: 'Created',
            content: firewall.data.createdAt.toLocaleString()
          }
        ]}
      />

      <Spacer size={20} />

      <PageHeader
        size="5"
        title="Network Policies"
        description="Network policies define which connections this firewall allows or blocks."
        actions={
          canWrite ?
            <Button
              size="2"
              onClick={() =>
                showCreatePolicyModal({
                  instanceId: instance.data!.id,
                  firewallId: firewall.data.id,
                  onComplete: () => firewall.refetch()
                })
              }
            >
              Create Policy
            </Button>
          : undefined
        }
      />

      {firewall.data.networkPolicies.length > 0 ? (
        <Stack>
          {firewall.data.networkPolicies.map(policy => (
            <PolicyBox
              key={policy.id}
              instanceId={instance.data!.id}
              firewallId={firewall.data.id}
              policyId={policy.id}
              canWrite={canWrite}
              onComplete={() => firewall.refetch()}
            />
          ))}
        </Stack>
      ) : (
        <EmptyText>No policies attached to this firewall.</EmptyText>
      )}
    </>
  ));
};
