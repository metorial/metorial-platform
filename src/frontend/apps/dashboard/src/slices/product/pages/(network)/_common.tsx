import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments
} from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

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
  <Badge color={status === 'active' ? 'green' : status === 'archived' ? 'orange' : 'gray'}>
    {status}
  </Badge>
);

export let EnclavesTable = (p: {
  enclaves: {
    id: string;
    name: string;
    description: string | null;
    networkId: string;
    providerDeploymentId: string;
    lastUsedAt: Date | null;
    createdAt: Date;
  }[];
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let providerDeploymentIds = useMemo(
    () => Array.from(new Set(p.enclaves.map(enclave => enclave.providerDeploymentId))),
    [p.enclaves]
  );
  let providerDeploymentsFilter = useMemo(
    () =>
      providerDeploymentIds.length > 0
        ? { id: providerDeploymentIds, limit: providerDeploymentIds.length }
        : { id: ['__none__'], limit: 1 },
    [providerDeploymentIds]
  );
  let providerDeployments = useProviderDeployments(
    instance.data?.id,
    providerDeploymentsFilter
  );

  return renderWithLoader({ providerDeployments })(({ providerDeployments }) => {
    let deploymentById = new Map(
      providerDeployments.data.items.map(deployment => [deployment.id, deployment])
    );

    return (
      <Table
        headers={['Name', 'Deployment', 'Last Used', 'Created']}
        data={p.enclaves.map(enclave => {
          let deployment = deploymentById.get(enclave.providerDeploymentId);

          return {
            href: Paths.instance.providerDeployment(
              organization.data,
              project.data,
              instance.data,
              enclave.providerDeploymentId,
              'network'
            ),
            data: [
              <div>
                <Text size="2" weight="strong">
                  {enclave.name}
                </Text>
                {enclave.description && (
                  <Text size="1" color="gray600">
                    {enclave.description}
                  </Text>
                )}
              </div>,
              deployment?.name ?? enclave.providerDeploymentId,
              enclave.lastUsedAt ? <RenderDate date={enclave.lastUsedAt} /> : '-',
              <RenderDate date={enclave.createdAt} />
            ]
          };
        })}
      />
    );
  });
};

export let RuleTable = (p: {
  rules: {
    id: string;
    effect: 'allow' | 'deny';
    direction: 'ingress' | 'egress';
    cidrs: string[];
    ports: { from: number; to: number }[] | null;
    enabled: boolean;
    priority: number;
    description: string | null;
  }[];
}) => (
  <Table
    headers={['Effect', 'Direction', 'CIDRs', 'Ports', 'Priority', 'Enabled']}
    data={p.rules.map(rule => ({
      data: [
        <Badge color={rule.effect === 'allow' ? 'green' : 'red'}>{rule.effect}</Badge>,
        <Text size="2">{rule.direction}</Text>,
        <Text size="2">{rule.cidrs.join(', ')}</Text>,
        <Text size="2">
          {rule.ports?.map(port => `${port.from}-${port.to}`).join(', ') ?? 'All'}
        </Text>,
        <Text size="2">{rule.priority}</Text>,
        <Badge color={rule.enabled ? 'green' : 'gray'}>{rule.enabled ? 'Yes' : 'No'}</Badge>
      ]
    }))}
  />
);

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
