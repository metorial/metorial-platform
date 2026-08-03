import { renderWithLoader } from '@metorial/data-hooks';
import { useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '@metorial/empty-state';

export let useNetworkManagementAccess = () => {
  let flags = useDashboardFlags();

  return {
    flags,
    isEnabled: !!flags.data?.flags['networking-enabled'],
    isPaid: !!flags.data?.flags['paid-networking'],
    hasPublicIpAccess: !!flags.data?.flags['paid-network-ip-access'],
    canWrite:
      !!flags.data?.flags['networking-enabled'] && !!flags.data?.flags['paid-networking']
  };
};

export let getDisplayedNetworkPublicIp = (
  ip: string | undefined,
  hasPublicIpAccess: boolean
) => (hasPublicIpAccess ? ip ?? '-' : 'shared');

export let NetworkManagedPage = ({ children }: { children: React.ReactNode }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    if (!flags.data.flags['networking-enabled']) {
      return (
        <ComingSoon
          title="Metorial Magic Network"
          description="Monitor network activity, manage firewalls, and control egress for provider deployments in secure enclaves."
        />
      );
    }

    if (!flags.data.flags['paid-networking']) {
      return (
        <Upgrade
          title="Metorial Magic Network"
          description="Monitor network activity, manage firewalls, and control egress for provider deployments in secure enclaves."
        />
      );
    }

    return children;
  });
};
