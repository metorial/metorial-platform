import { renderWithLoader } from '@metorial/data-hooks';
import { useDashboardFlags } from '@metorial/state';
import { Error } from '@metorial/ui';
import { Upgrade } from '../../../../components/emptyState';

type PortalFlags = Record<string, boolean | null | undefined> | null | undefined;

export let isPortalManagementEnabled = (flags: PortalFlags) => !!flags?.['portals-access'];

export let isPortalManagementPaid = (flags: PortalFlags) => !!flags?.['paid-portals'];

export let canAccessPortalManagement = (flags: PortalFlags) =>
  isPortalManagementEnabled(flags) && isPortalManagementPaid(flags);

export let canShowPortalManagementNavigation = (flags: PortalFlags) =>
  canAccessPortalManagement(flags);

export let isPortalAuthPaid = (flags: PortalFlags) => !!flags?.['paid-sso-tenants'];

export let canAccessPortalAuth = (flags: PortalFlags) =>
  canAccessPortalManagement(flags) && isPortalAuthPaid(flags);

export let canShowPortalAuthNavigation = (flags: PortalFlags) =>
  canAccessPortalManagement(flags);

let PortalManagementUpgrade = () => (
  <Upgrade
    title="Portals"
    description="Manage consumer-facing portals and reusable provider templates once this instance is upgraded."
  />
);

let PortalManagementUnavailableError = () => (
  <Error style={{ marginTop: 20 }}>
    Portal management is not enabled for this instance.
  </Error>
);

let PortalAuthUpgrade = () => (
  <Upgrade
    title="Portal Authentication"
    description="Configure portal SSO tenants once this instance is upgraded."
  />
);

let getPortalManagementGateContent = (flags: PortalFlags) => {
  if (!isPortalManagementEnabled(flags)) {
    return <PortalManagementUnavailableError />;
  }

  if (!isPortalManagementPaid(flags)) {
    return <PortalManagementUpgrade />;
  }

  return null;
};

export let PortalManagementGate = (props: { children: React.ReactNode }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    let gatedContent = getPortalManagementGateContent(flags.data?.flags);

    return gatedContent ?? <>{props.children}</>;
  });
};

export let PortalAuthGate = (props: { children: React.ReactNode }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    let portalManagementGateContent = getPortalManagementGateContent(flags.data?.flags);

    if (portalManagementGateContent) {
      return portalManagementGateContent;
    }

    return isPortalAuthPaid(flags.data?.flags) ? (
      <>{props.children}</>
    ) : (
      <PortalAuthUpgrade />
    );
  });
};

export let getPortalTargetLabel = (
  target:
    | {
        type: 'provider_template';
        providerTemplate: {
          name: string;
        };
      }
    | {
        type: 'magic_mcp_server';
        magicMcpServer: {
          id: string;
          name: string | null;
        };
      }
) => {
  if (target.type == 'provider_template') {
    return target.providerTemplate.name;
  }

  return target.magicMcpServer.name ?? target.magicMcpServer.id;
};

export let getPortalTargetTypeLabel = (
  target:
    | {
        type: 'provider_template';
      }
    | {
        type: 'magic_mcp_server';
      }
) => {
  return target.type == 'provider_template' ? 'Provider Template' : 'Magic MCP Server';
};
