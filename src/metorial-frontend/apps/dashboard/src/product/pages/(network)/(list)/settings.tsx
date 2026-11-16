import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrationFirewallAssignments,
  useIntegrationInternetGateway
} from '@metorial/state';
import { Attributes, Button, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { showApplyFirewallPanel } from '../_applyFirewallPanel';
import { EmptyText, FirewallBindingsTable } from '../_common';
import { useNetworkManagementAccess } from '../_gate';

let RestrictedPublicIp = styled.span`
  filter: blur(4px);
  user-select: none;
`;

export let InternetGatewayRedirect = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let location = useLocation();

  return renderWithLoader({ organization, project, instance })(() => (
    <Navigate
      replace
      to={`${Paths.instance.networkSettings(organization.data, project.data, instance.data)}${location.search}${location.hash}`}
    />
  ));
};

export let NetworkSettingsPage = () => {
  let instance = useCurrentInstance();
  let { canWrite, hasPublicIpAccess } = useNetworkManagementAccess();
  let internetGateway = useIntegrationInternetGateway(instance.data?.id);
  let firewallBindings = useIntegrationFirewallAssignments(instance.data?.id, {
    limit: 100,
    order: 'desc'
  });

  return renderWithLoader({ internetGateway, firewallBindings })(
    ({ internetGateway, firewallBindings }) => {
      let gateway = internetGateway.data;
      let publicIp = gateway?.publicIps[0];
      let publicIpRestricted = !hasPublicIpAccess || publicIp?.ip === 'x.x.x.x';
      let gatewayBindings = firewallBindings.data.items.filter(
        binding => binding.targetType === 'internet_gateway'
      );

      return (
        <>
          {gateway ? (
            <Attributes
              itemWidth="300px"
              attributes={[
                { label: 'Name', content: gateway.name },
                {
                  label: 'Public IP',
                  content: publicIpRestricted ? (
                    <RestrictedPublicIp aria-label="Public IP unavailable on this plan">
                      123.45.67.89
                    </RestrictedPublicIp>
                  ) : (
                    (publicIp?.ip ?? '-')
                  )
                },
                { label: 'Region', content: publicIp?.region ?? '-' }
              ]}
            />
          ) : (
            <EmptyText>No integration internet gateway found.</EmptyText>
          )}

          <Spacer size={20} />

          <Box
            title="Applied Firewalls"
            description="Firewall bindings that apply to the integration internet gateway."
            rightActions={
              gateway && canWrite ? (
                <Button
                  size="2"
                  onClick={() =>
                    showApplyFirewallPanel({
                      instanceId: instance.data!.id,
                      targetType: 'internet_gateway',
                      targetId: gateway.id,
                      title: 'Apply Firewall',
                      description:
                        'Choose the firewalls that should apply to the integration internet gateway.',
                      onComplete: () => firewallBindings.refetch()
                    })
                  }
                >
                  Apply Firewall
                </Button>
              ) : undefined
            }
          >
            <FirewallBindingsTable
              bindings={gatewayBindings}
              instanceId={instance.data!.id}
              canWrite={canWrite}
              showTarget
              onChange={() => firewallBindings.refetch()}
              emptyState="No firewalls are applied to the integration internet gateway."
            />
          </Box>
        </>
      );
    }
  );
};
