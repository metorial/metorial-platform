import { Paths } from '@metorial/frontend-config';
import { SidebarLayout } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  RiCpuLine,
  RiGlobalLine,
  RiHardDrive3Line,
  RiPlayCircleLine,
  RiSettings3Line,
  RiTimerLine
} from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';

export let SandboxMachineSettingsLayout = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  let { machineId } = useParams();

  let navItem = (icon: React.ReactNode, label: string, ...subPages: string[]) => {
    let to = Paths.instance.sandboxMachine(
      organization.data,
      project.data,
      instance.data,
      machineId,
      'settings',
      ...subPages
    );

    return {
      icon,
      label,
      to,
      getProps: (i: { pathname: string }) => ({ isActive: i.pathname === to })
    };
  };

  return (
    <SidebarLayout
      id="sandbox-machine-settings"
      groups={[
        {
          label: '',
          items: [
            navItem(<RiSettings3Line />, 'General'),
            navItem(<RiCpuLine />, 'Size', 'size'),
            navItem(<RiHardDrive3Line />, 'Storage', 'storage'),
            navItem(<RiPlayCircleLine />, 'Runtime', 'runtime'),
            navItem(<RiTimerLine />, 'Lifecycle', 'lifecycle'),
            navItem(<RiGlobalLine />, 'Network', 'network')
          ]
        }
      ]}
    >
      <Outlet />
    </SidebarLayout>
  );
};
