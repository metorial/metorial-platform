import {
  DashboardInstanceEnclavesGetLastUsedQuery,
  DashboardInstanceEnclavesListQuery,
  DashboardInstanceFirewallBindingsCreateBody,
  DashboardInstanceFirewallBindingsListQuery,
  DashboardInstanceFirewallsCreateBody,
  DashboardInstanceFirewallsListQuery,
  DashboardInstanceFirewallsNetworkPoliciesAttachBody,
  DashboardInstanceFirewallsUpdateBody,
  DashboardInstanceNetworkPoliciesCreateBody,
  DashboardInstanceNetworkPoliciesListQuery,
  DashboardInstanceNetworkPoliciesRulesCreateBody,
  DashboardInstanceNetworkPoliciesUpdateBody,
  DashboardInstanceNetworksListNetworkLogsQuery,
  DashboardInstanceNetworksListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let networksLoader = createLoader({
  name: 'networks',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceNetworksListQuery) =>
    withAuth(sdk => sdk.networks.list(i.instanceId, i)),
  mutators: {}
});

export let useNetworks = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceNetworksListQuery | null
) => {
  return usePaginator(pagination =>
    networksLoader.use(
      instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
    )
  );
};

export let useDefaultNetwork = (instanceId: string | null | undefined) => {
  let networks = networksLoader.use(instanceId ? { instanceId, limit: 1 } : null);

  return {
    ...networks,
    data: networks.data?.items[0] ?? null
  };
};

export let networkLoader = createLoader({
  name: 'network',
  parents: [networksLoader],
  fetch: (i: { instanceId: string; networkId: string }) =>
    withAuth(sdk => sdk.networks.get(i.instanceId, i.networkId)),
  mutators: {}
});

export let useNetwork = (
  instanceId: string | null | undefined,
  networkId: string | null | undefined
) => networkLoader.use(instanceId && networkId ? { instanceId, networkId } : null);

export let networkLogsLoader = createLoader({
  name: 'networkLogs',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceNetworksListNetworkLogsQuery) =>
    withAuth(sdk => sdk.networks.listNetworkLogs(i.instanceId, i)),
  mutators: {}
});

export let useNetworkLogs = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceNetworksListNetworkLogsQuery | null
) => networkLogsLoader.use(instanceId && query !== null ? { instanceId, ...(query ?? {}) } : null);

export let enclavesLoader = createLoader({
  name: 'enclaves',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceEnclavesListQuery) =>
    withAuth(sdk => sdk.enclaves.list(i.instanceId, i)),
  mutators: {}
});

export let useEnclaves = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceEnclavesListQuery | null
) => {
  return usePaginator(
    pagination =>
      enclavesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let enclaveLoader = createLoader({
  name: 'enclave',
  parents: [enclavesLoader],
  fetch: (i: { instanceId: string; enclaveId: string }) =>
    withAuth(sdk => sdk.enclaves.get(i.instanceId, i.enclaveId)),
  mutators: {}
});

export let useEnclave = (
  instanceId: string | null | undefined,
  enclaveId: string | null | undefined
) => enclaveLoader.use(instanceId && enclaveId ? { instanceId, enclaveId } : null);

export let lastUsedEnclavesLoader = createLoader({
  name: 'lastUsedEnclaves',
  parents: [enclavesLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceEnclavesGetLastUsedQuery) =>
    withAuth(sdk => sdk.enclaves.getLastUsed(i.instanceId, i)),
  mutators: {}
});

export let useLastUsedEnclaves = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceEnclavesGetLastUsedQuery | null
) =>
  lastUsedEnclavesLoader.use(
    instanceId && query !== null ? { instanceId, ...(query ?? {}) } : null
  );

export let firewallsLoader = createLoader({
  name: 'firewalls',
  parents: [networksLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceFirewallsListQuery) =>
    withAuth(sdk => sdk.firewalls.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateFirewall = firewallsLoader.createExternalMutator(
  (i: DashboardInstanceFirewallsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.firewalls.create(i.instanceId, i)),
  { disableToast: true }
);

export let useFirewalls = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceFirewallsListQuery | null
) => {
  return usePaginator(pagination =>
    firewallsLoader.use(
      instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
    )
  );
};

export let firewallLoader = createLoader({
  name: 'firewall',
  parents: [firewallsLoader],
  fetch: (i: { instanceId: string; firewallId: string }) =>
    withAuth(sdk => sdk.firewalls.get(i.instanceId, i.firewallId)),
  mutators: {
    update: (
      body: DashboardInstanceFirewallsUpdateBody,
      { input: { instanceId, firewallId } }
    ) => withAuth(sdk => sdk.firewalls.update(instanceId, firewallId, body)),
    delete: (_, { input: { instanceId, firewallId } }) =>
      withAuth(sdk => sdk.firewalls.delete(instanceId, firewallId))
  }
});

export let useFirewall = (
  instanceId: string | null | undefined,
  firewallId: string | null | undefined
) => {
  let data = firewallLoader.use(instanceId && firewallId ? { instanceId, firewallId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let useAttachNetworkPolicyToFirewall = firewallLoader.createExternalMutator(
  (
    i: DashboardInstanceFirewallsNetworkPoliciesAttachBody & {
      instanceId: string;
      firewallId: string;
    }
  ) => withAuth(sdk => sdk.firewalls.networkPolicies.attach(i.instanceId, i.firewallId, i)),
  { disableToast: true }
);

export let useDetachNetworkPolicyFromFirewall = firewallLoader.createExternalMutator(
  (i: { instanceId: string; firewallId: string; networkPolicyId: string }) =>
    withAuth(sdk =>
      sdk.firewalls.networkPolicies.detach(i.instanceId, i.firewallId, i.networkPolicyId)
    )
);

export let firewallBindingsLoader = createLoader({
  name: 'firewallBindings',
  parents: [firewallsLoader, enclavesLoader, networksLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceFirewallBindingsListQuery) =>
    withAuth(sdk => sdk.firewallBindings.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateFirewallBinding = firewallBindingsLoader.createExternalMutator(
  (i: DashboardInstanceFirewallBindingsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.firewallBindings.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteFirewallBinding = firewallBindingsLoader.createExternalMutator(
  (i: { instanceId: string; firewallBindingId: string }) =>
    withAuth(sdk => sdk.firewallBindings.delete(i.instanceId, i.firewallBindingId))
);

export let useFirewallBindings = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceFirewallBindingsListQuery | null
) => {
  return usePaginator(
    pagination =>
      firewallBindingsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let networkPoliciesLoader = createLoader({
  name: 'networkPolicies',
  parents: [firewallsLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceNetworkPoliciesListQuery) =>
    withAuth(sdk => sdk.networkPolicies.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateNetworkPolicy = networkPoliciesLoader.createExternalMutator(
  (i: DashboardInstanceNetworkPoliciesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.networkPolicies.create(i.instanceId, i)),
  { disableToast: true }
);

export let useNetworkPolicies = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceNetworkPoliciesListQuery | null
) => {
  return usePaginator(
    pagination =>
      networkPoliciesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let networkPolicyLoader = createLoader({
  name: 'networkPolicy',
  parents: [networkPoliciesLoader],
  fetch: (i: { instanceId: string; networkPolicyId: string }) =>
    withAuth(sdk => sdk.networkPolicies.get(i.instanceId, i.networkPolicyId)),
  mutators: {
    update: (
      body: DashboardInstanceNetworkPoliciesUpdateBody,
      { input: { instanceId, networkPolicyId } }
    ) => withAuth(sdk => sdk.networkPolicies.update(instanceId, networkPolicyId, body)),
    delete: (_, { input: { instanceId, networkPolicyId } }) =>
      withAuth(sdk => sdk.networkPolicies.delete(instanceId, networkPolicyId)),
    createRule: (
      body: DashboardInstanceNetworkPoliciesRulesCreateBody,
      { input: { instanceId, networkPolicyId } }
    ) => withAuth(sdk => sdk.networkPolicies.rules.create(instanceId, networkPolicyId, body)),
    updateRule: (
      body: {
        ruleId: string;
        rule: NonNullable<DashboardInstanceNetworkPoliciesUpdateBody['rules']>[number];
        currentRules: {
          id: string;
          effect: 'allow' | 'deny';
          direction: 'ingress' | 'egress';
          cidrs: string[];
          description: string | null;
          enabled: boolean;
          priority: number;
          ports: { from: number; to: number }[] | null;
        }[];
      },
      { input: { instanceId, networkPolicyId } }
    ) =>
      withAuth(sdk =>
        sdk.networkPolicies.update(instanceId, networkPolicyId, {
          rules: body.currentRules.map(rule =>
            rule.id === body.ruleId
              ? body.rule
              : {
                  effect: rule.effect,
                  direction: rule.direction,
                  cidrs: rule.cidrs,
                  description: rule.description ?? undefined,
                  enabled: rule.enabled,
                  priority: rule.priority,
                  ports: rule.direction === 'egress' ? rule.ports ?? undefined : undefined
                }
          )
        })
      ),
    deleteRule: (
      body: { ruleId: string },
      { input: { instanceId, networkPolicyId } }
    ) => withAuth(sdk => sdk.networkPolicies.rules.delete(instanceId, networkPolicyId, body.ruleId))
  }
});

export let useNetworkPolicy = (
  instanceId: string | null | undefined,
  networkPolicyId: string | null | undefined
) => {
  let data = networkPolicyLoader.use(
    instanceId && networkPolicyId ? { instanceId, networkPolicyId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useCreateRuleMutator: data.useMutator('createRule'),
    useUpdateRuleMutator: data.useMutator('updateRule'),
    useDeleteRuleMutator: data.useMutator('deleteRule')
  };
};
