import {
  StatusBadge,
  col,
  createDataList,
  defineAction,
  lifecycleStatus
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIntegrationFirewallAssignment,
  useProviderDeployments
} from '@metorial/state';
import { Badge, Text, theme } from '@metorial/ui';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';

export let Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export let Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export let UsageBars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let UsageBar = styled.div<{ $size: number }>`
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 3fr 60px;
  align-items: center;
  gap: 12px;

  > div:nth-child(2) {
    height: 10px;
    border-radius: 999px;
    background: ${theme.colors.gray300};
    overflow: hidden;
  }

  > div:nth-child(2)::before {
    content: '';
    display: block;
    width: ${p => p.$size}%;
    height: 100%;
    background: ${theme.colors.blue700};
  }
`;

export let EmptyText = ({ children }: { children: React.ReactNode }) => (
  <Text size="2" color="gray600" align="center" style={{ padding: 20 }}>
    {children}
  </Text>
);

export let statusBadge = (status: 'active' | 'archived' | 'deleted') => (
  <StatusBadge status={status} descriptor={lifecycleStatus} />
);

type EnclaveRow = {
  id: string;
  name: string;
  description: string | null;
  internetGatewayId: string;
  providerDeploymentId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

type EnclaveWithDeployment = EnclaveRow & { deploymentName: string };

let EnclavesList = createDataList<{ enclaves: EnclaveRow[] }>('network-enclaves-embedded', {
  customizable: false
})
  .context(useInstanceContext)
  .items(({ props, ctx }) => {
    let providerDeploymentIds = useMemo(
      () => Array.from(new Set(props.enclaves.map(enclave => enclave.providerDeploymentId))),
      [props.enclaves]
    );
    let providerDeploymentsFilter = useMemo(
      () =>
        providerDeploymentIds.length > 0
          ? { id: providerDeploymentIds, limit: providerDeploymentIds.length }
          : { id: ['__none__'], limit: 1 },
      [providerDeploymentIds]
    );
    let providerDeployments = useProviderDeployments(
      ctx.instanceId,
      providerDeploymentsFilter
    );

    let items = useMemo(() => {
      let names = new Map(
        (providerDeployments.data?.items ?? []).map(deployment => [
          deployment.id,
          deployment.name
        ])
      );

      return props.enclaves.map(enclave => ({
        ...enclave,
        deploymentName: names.get(enclave.providerDeploymentId) ?? enclave.providerDeploymentId
      }));
    }, [props.enclaves, providerDeployments.data?.items]);

    return {
      items,
      isLoading: providerDeployments.isLoading,
      error: providerDeployments.error
    };
  })
  .columns([
    col.name<EnclaveWithDeployment>(),
    col.text<EnclaveWithDeployment>({
      id: 'deployment',
      header: 'Deployment',
      get: enclave => enclave.deploymentName
    }),
    col.date<EnclaveWithDeployment>('lastUsedAt', {
      id: 'lastUsedAt',
      header: 'Last Used',
      isDefault: true
    }),
    col.createdAt<EnclaveWithDeployment>()
  ])
  .link((enclave, _props, ctx) =>
    Paths.instance.providerDeployment(
      ctx.organization,
      ctx.project,
      ctx.instance,
      enclave.providerDeploymentId,
      'network'
    )
  )
  .build();

export let EnclavesTable = (p: { enclaves: EnclaveRow[] }) => (
  <EnclavesList enclaves={p.enclaves} listVariant="embedded" />
);

type Rule = {
  id: string;
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  ports: { from: number; to: number }[] | null;
  enabled: boolean;
  priority: number;
  description: string | null;
};

let RulesList = createDataList<{ rules: Rule[] }>('network-rules-embedded', {
  customizable: false
})
  .items(({ props }) => ({ items: props.rules }))
  .columns([
    col.custom<Rule>({
      id: 'effect',
      header: 'Effect',
      render: rule => (
        <Badge color={rule.effect === 'allow' ? 'green' : 'red'}>{rule.effect}</Badge>
      )
    }),
    col.text<Rule>({ id: 'direction', header: 'Direction', get: rule => rule.direction }),
    col.text<Rule>({ id: 'cidrs', header: 'CIDRs', get: rule => rule.cidrs.join(', ') }),
    col.text<Rule>({
      id: 'ports',
      header: 'Ports',
      get: rule => rule.ports?.map(port => `${port.from}-${port.to}`).join(', ') ?? 'All'
    }),
    col.text<Rule>({ id: 'priority', header: 'Priority', get: rule => rule.priority }),
    col.custom<Rule>({
      id: 'enabled',
      header: 'Enabled',
      render: rule => (
        <Badge color={rule.enabled ? 'green' : 'gray'}>{rule.enabled ? 'Yes' : 'No'}</Badge>
      )
    })
  ])
  .build();

export let RuleTable = (p: { rules: Rule[] }) => (
  <RulesList rules={p.rules} listVariant="embedded" />
);

type FirewallBinding = {
  id: string;
  firewall: { name: string };
  target?: { name?: string | null } | null;
  createdAt: Date;
};

type FirewallBindingsProps = {
  bindings: FirewallBinding[];
  instanceId: string;
  onChange?: () => void;
};

let createFirewallBindingsList = (opts: { canWrite: boolean; showTarget: boolean }) =>
  createDataList<FirewallBindingsProps>(
    `network-firewall-bindings${opts.showTarget ? '-with-target' : ''}`,
    { customizable: false }
  )
    .items(({ props }) => ({ items: props.bindings }))
    .columns([
      col.text<FirewallBinding>({
        id: 'firewall',
        header: 'Firewall',
        weight: 'strong',
        get: binding => binding.firewall.name
      }),
      ...(opts.showTarget
        ? [
            col.text<FirewallBinding>({
              id: 'target',
              header: 'Target',
              get: binding => binding.target?.name ?? 'Integration Internet Gateway'
            })
          ]
        : []),
      col.createdAt<FirewallBinding>()
    ])
    .itemActions(
      opts.canWrite
        ? [
            defineAction<FirewallBinding, FirewallBindingsProps>({
              id: 'remove',
              label: 'Remove',
              destructive: true,
              useRun: ({ props }) => {
                let deleteBinding = useDeleteIntegrationFirewallAssignment();

                return async binding => {
                  await deleteBinding.mutate({
                    instanceId: props.instanceId,
                    integrationFirewallAssignmentId: binding.id
                  });
                  props.onChange?.();
                };
              }
            })
          ]
        : []
    )
    .build();

let firewallBindingsLists = new Map<string, ReturnType<typeof createFirewallBindingsList>>();

let getFirewallBindingsList = (opts: { canWrite: boolean; showTarget: boolean }) => {
  let key = `${opts.canWrite}:${opts.showTarget}`;
  let list = firewallBindingsLists.get(key) ?? createFirewallBindingsList(opts);
  firewallBindingsLists.set(key, list);
  return list;
};

export let FirewallBindingsTable = ({
  canWrite,
  showTarget = false,
  emptyState,
  ...props
}: FirewallBindingsProps & {
  canWrite: boolean;
  showTarget?: boolean;
  emptyState: string;
}) => {
  let List = getFirewallBindingsList({ canWrite, showTarget });

  return <List {...props} listVariant="embedded" emptyState={emptyState} />;
};

export let FirewallLink = (p: { firewall: { id: string; name: string } }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return (
    <Link
      to={Paths.instance.networkFirewall(
        organization.data,
        project.data,
        instance.data,
        p.firewall.id
      )}
    >
      {p.firewall.name}
    </Link>
  );
};
