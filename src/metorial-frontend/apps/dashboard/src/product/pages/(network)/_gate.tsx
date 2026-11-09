import { ContentLayout } from '@metorial/layout';
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
) => (hasPublicIpAccess ? (ip ?? '-') : 'shared');

let defaultTitle = 'Integration Internet Gateway';
let defaultDescription =
  'Monitor network activity, manage firewalls, and control egress for provider deployments in secure enclaves.';

export let NetworkManagedPage = ({
  children,
  fallbackWithLayout = false,
  title = defaultTitle,
  description = defaultDescription
}: {
  children: React.ReactNode;
  fallbackWithLayout?: boolean;
  title?: string;
  description?: string;
}) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    let fallback = (content: React.ReactNode) =>
      fallbackWithLayout ? <ContentLayout>{content}</ContentLayout> : content;

    if (!flags.data.flags['networking-enabled']) {
      return fallback(<ComingSoon title={title} description={description} />);
    }

    if (!flags.data.flags['paid-networking']) {
      return fallback(<Upgrade title={title} description={description} />);
    }

    return children;
  });
};
