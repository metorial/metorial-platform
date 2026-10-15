import { renderWithLoader } from '@metorial/data-hooks';
import { ComingSoon, Upgrade } from '@metorial/empty-state';
import { ContentLayout } from '@metorial/layout';
import { useDashboardFlags } from '@metorial/state';
import React from 'react';

let sandboxesTitle = 'Sandboxes';
let sandboxesDescription =
  'Run isolated machines that start in seconds, build your own images and keep data on persistent disks.';

export let useSandboxAccess = () => {
  let flags = useDashboardFlags();

  let isEnabled = !!flags.data?.flags['sandbox-enabled'];
  let isPaid = !!flags.data?.flags['paid-sandboxes'];

  return {
    flags,
    isEnabled,
    isPaid,
    canWrite: isEnabled && isPaid
  };
};

export let SandboxManagedPage = ({
  children,
  withLayout
}: {
  children: React.ReactNode;
  withLayout?: boolean;
}) => {
  let flags = useDashboardFlags();

  let wrap = (fallback: React.ReactNode) =>
    withLayout ? <ContentLayout>{fallback}</ContentLayout> : fallback;

  return renderWithLoader({ flags })(({ flags }) => {
    if (!flags.data.flags['sandbox-enabled']) {
      return wrap(<ComingSoon title={sandboxesTitle} description={sandboxesDescription} />);
    }

    if (!flags.data.flags['paid-sandboxes']) {
      return wrap(<Upgrade title={sandboxesTitle} description={sandboxesDescription} />);
    }

    return children;
  });
};
