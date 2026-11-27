import { SidebarLayout } from '@metorial/layout';
import { RiListCheck, RiTerminalBoxLine } from '@remixicon/react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSandboxMachinePage } from '../../../scenes/sandbox/machines/context';

export let SandboxMachineActivityLayout = () => {
  let { machine, path } = useSandboxMachinePage();
  let eventsPath = path('logs');
  let logsPath = path('logs', 'runtime');

  return (
    <SidebarLayout
      id="sandbox-machine-activity"
      groups={[
        {
          label: '',
          items: [
            {
              icon: <RiListCheck />,
              label: 'Events',
              to: eventsPath,
              getProps: ({ pathname }: { pathname: string }) => ({
                isActive: pathname === eventsPath
              })
            },
            ...(machine.data?.status === 'terminated'
              ? []
              : [
                  {
                    icon: <RiTerminalBoxLine />,
                    label: 'Runtime Logs',
                    to: logsPath,
                    getProps: ({ pathname }: { pathname: string }) => ({
                      isActive: pathname === logsPath
                    })
                  }
                ])
          ]
        }
      ]}
    >
      <Outlet />
    </SidebarLayout>
  );
};

export let SandboxMachineEventsRedirect = () => {
  let { path } = useSandboxMachinePage();
  let location = useLocation();

  return (
    <Navigate
      to={`${location.pathname.endsWith('/events/logs') ? path('logs', 'runtime') : path('logs')}${location.search}`}
      replace
    />
  );
};
