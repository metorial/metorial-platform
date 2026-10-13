import {
  DashboardInstanceIntegrationEnclavesGetLastUsedQuery,
  DashboardInstanceIntegrationEnclavesListQuery,
  DashboardInstanceIntegrationFirewallAssignmentsCreateBody,
  DashboardInstanceIntegrationFirewallAssignmentsListQuery,
  DashboardInstanceFirewallsCreateBody,
  DashboardInstanceFirewallsListQuery,
  DashboardInstanceFirewallsNetworkPoliciesAttachBody,
  DashboardInstanceFirewallsUpdateBody,
  DashboardInstanceNetworkPoliciesCreateBody,
  DashboardInstanceNetworkPoliciesListQuery,
  DashboardInstanceNetworkPoliciesRulesCreateBody,
  DashboardInstanceNetworkPoliciesUpdateBody,
  DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let integrationInternetGatewayLoader = createLoader({
  name: 'integrationInternetGateway',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.integrationInternetGateway.get(i.instanceId)),
  mutators: {}
});

export let useIntegrationInternetGateway = (instanceId: string | null | undefined) =>
  integrationInternetGatewayLoader.use(instanceId ? { instanceId } : null);

export let networkLogsLoader = createLoader({
  name: 'networkLogs',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery
  ) => withAuth(sdk => sdk.integrationInternetGateway.listNetworkLogs(i.instanceId, i)),
  mutators: {}
});

export let useNetworkLogs = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery | null
) => {
  let queryWithDirection = {
    direction: 'egress',
    ...(query ?? {})
  } as DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery;

  return networkLogsLoader.use(
    instanceId && query !== null ? { instanceId, ...queryWithDirection } : null
  );
};

export let integrationEnclavesLoader = createLoader({
  name: 'integrationEnclaves',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIntegrationEnclavesListQuery) =>
    withAuth(sdk => sdk.integrationEnclaves.list(i.instanceId, i)),
  mutators: {}
});

export let useIntegrationEnclaves = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationEnclavesListQuery | null
) => {
  return usePaginator(
    pagination =>
      integrationEnclavesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );
};

export let integrationEnclaveLoader = createLoader({
  name: 'integrationEnclave',
  parents: [integrationEnclavesLoader],
  fetch: (i: { instanceId: string; integrationEnclaveId: string }) =>
    withAuth(sdk => sdk.integrationEnclaves.get(i.instanceId, i.integrationEnclaveId)),
  mutators: {}
});

export let useIntegrationEnclave = (
  instanceId: string | null | undefined,
  integrationEnclaveId: string | null | undefined
) =>
  integrationEnclaveLoader.use(
    instanceId && integrationEnclaveId ? { instanceId, integrationEnclaveId } : null
  );

export let lastUsedIntegrationEnclavesLoader = createLoader({
  name: 'lastUsedIntegrationEnclaves',
  parents: [integrationEnclavesLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceIntegrationEnclavesGetLastUsedQuery) =>
    withAuth(sdk => sdk.integrationEnclaves.getLastUsed(i.instanceId, i)),
  mutators: {}
});

export let useLastUsedIntegrationEnclaves = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationEnclavesGetLastUsedQuery | null
) =>
  lastUsedIntegrationEnclavesLoader.use(
    instanceId && query !== null ? { instanceId, ...(query ?? {}) } : null
  );

export let firewallsLoader = createLoader({
  name: 'firewalls',
  parents: [integrationInternetGatewayLoader],
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

export let integrationFirewallAssignmentsLoader = createLoader({
  name: 'integrationFirewallAssignments',
  parents: [firewallsLoader, integrationEnclavesLoader, integrationInternetGatewayLoader],
  fetch: (
    i: { instanceId: string } & DashboardInstanceIntegrationFirewallAssignmentsListQuery
  ) => withAuth(sdk => sdk.integrationFirewallAssignments.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateIntegrationFirewallAssignment =
  integrationFirewallAssignmentsLoader.createExternalMutator(
    (i: DashboardInstanceIntegrationFirewallAssignmentsCreateBody & { instanceId: string }) =>
      withAuth(sdk => sdk.integrationFirewallAssignments.create(i.instanceId, i)),
    { disableToast: true }
  );

export let useDeleteIntegrationFirewallAssignment =
  integrationFirewallAssignmentsLoader.createExternalMutator(
    (i: { instanceId: string; integrationFirewallAssignmentId: string }) =>
      withAuth(sdk =>
        sdk.integrationFirewallAssignments.delete(
          i.instanceId,
          i.integrationFirewallAssignmentId
        )
      )
  );

export let useIntegrationFirewallAssignments = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationFirewallAssignmentsListQuery | null
) => {
  return usePaginator(
    pagination =>
      integrationFirewallAssignmentsLoader.use(
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
                  ports: rule.direction === 'egress' ? (rule.ports ?? undefined) : undefined
                }
          )
        })
      ),
    deleteRule: (body: { ruleId: string }, { input: { instanceId, networkPolicyId } }) =>
      withAuth(sdk =>
        sdk.networkPolicies.rules.delete(instanceId, networkPolicyId, body.ruleId)
      )
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
