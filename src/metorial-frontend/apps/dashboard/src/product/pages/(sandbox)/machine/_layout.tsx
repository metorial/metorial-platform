import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { isSandboxMachineBusy, useSandboxImage, useSandboxRegions } from '@metorial/state';
import { Button, RenderDate, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiInstanceLine } from '@remixicon/react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { useSandboxMachinePage } from '../../../scenes/sandbox/machines/context';
import {
  SandboxMachineStatusBadge,
  getSandboxMachineStatus,
  getSandboxOperationKindLabel
} from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage } from '../_gate';

let SandboxMachineDetailsLayout = () => {
  let { machine, instance, path, machinesPath, diskPath, imagePath } = useSandboxMachinePage();
  let regions = useSandboxRegions(instance.data?.id);
  let image = useSandboxImage(instance.data?.id, machine.data?.image.id);
  let start = machine.useStartMutator();
  let pause = machine.usePauseMutator();
  let hibernate = machine.useHibernateMutator();
  let restart = machine.useRestartMutator();
  let navigate = useNavigate();
  let location = useLocation();

  let m = machine.data;
  let deleted = m?.status === 'terminated';
  let busy = m ? isSandboxMachineBusy(m) : false;

  let pending = start.isLoading || pause.isLoading || hibernate.isLoading || restart.isLoading;
  let primary = m?.status === 'running' ? pause : m?.status === 'failed' ? restart : start;

  let requestRestart = () =>
    m?.status === 'running'
      ? confirm({
          title: 'Restart Machine',
          description: 'Running processes are stopped.',
          confirmText: 'Restart',
          onConfirm: () => {
            restart.mutate();
          }
        })
      : restart.mutate();

  let tabs = deleted
    ? ['Overview', 'Logs']
    : ['Overview', 'Terminal', 'Files', 'Usage', 'Logs', 'Settings'];

  return (
    <DetailsLayout
      entity={
        m
          ? {
              ...m,
              slug: m.slug || undefined,
              name: m.name || m.slug || 'Untitled machine',
              description: [m.slug, image.data?.name || image.data?.identifier]
                .filter(Boolean)
                .join(' · ')
            }
          : undefined
      }
      icon={<RiInstanceLine />}
      breadcrumbs={[
        { label: 'Machines', to: machinesPath },
        { label: m ? m.name || m.slug || 'Untitled machine' : undefined, to: path() }
      ]}
      tabs={tabs.map(label => ({
        label,
        to: label === 'Overview' ? path() : path(label.toLowerCase())
      }))}
      actions={
        !m || deleted
          ? []
          : [
              ...(m.status === 'running' || m.status === 'paused'
                ? [
                    {
                      label: 'Open Terminal',
                      variant: 'outline' as const,
                      onClick: () => navigate(path('terminal')),
                      disabled: pending
                    }
                  ]
                : []),
              {
                type: 'custom',
                render: () => (
                  <Button
                    size="2"
                    disabled={busy || pending}
                    loading={busy || pending}
                    success={primary.isSuccess || hibernate.isSuccess || restart.isSuccess}
                    menu={
                      !busy && m.status !== 'hibernated'
                        ? m.status === 'failed'
                          ? [
                              {
                                label: 'Start',
                                disabled: pending,
                                onClick: () => {
                                  start.mutate();
                                }
                              }
                            ]
                          : [
                              {
                                label: 'Restart',
                                disabled: pending,
                                onClick: () => {
                                  requestRestart();
                                }
                              },
                              {
                                label: 'Hibernate',
                                disabled: pending,
                                onClick: () => {
                                  hibernate.mutate();
                                }
                              }
                            ]
                        : undefined
                    }
                    onClick={() =>
                      m.status === 'failed' ? requestRestart() : primary.mutate()
                    }
                  >
                    {busy
                      ? `${m.operation ? getSandboxOperationKindLabel(m.operation.kind) : getSandboxMachineStatus(m.status).label}…`
                      : m.status === 'running'
                        ? 'Pause'
                        : m.status === 'failed'
                          ? 'Restart'
                          : m.status === 'paused'
                            ? 'Resume'
                            : 'Start'}
                  </Button>
                )
              }
            ]
      }
      attributes={
        m
          ? [
              { label: 'Status', value: <SandboxMachineStatusBadge status={m.status} /> },
              {
                label: 'Image',
                value: m.image.id ? (
                  <a href={imagePath(m.image.id)}>
                    {image.data?.name || image.data?.identifier || m.image.id}
                  </a>
                ) : (
                  '—'
                )
              },
              {
                label: 'Specifications',
                value: m.spec ? `${m.spec.cpus} vCPU · ${m.spec.memoryGib} GiB` : '—'
              },
              {
                label: 'Region',
                value:
                  regions.data?.items.find(region => region.id === m.region)?.name || m.region
              },
              {
                label: 'Last Activity',
                value: m.lastActivityAt ? <RenderDate date={m.lastActivityAt} /> : '—'
              },
              { label: 'Created', value: <RenderDate date={m.createdAt} /> },
              {
                label: 'ID',
                value: <ID id={m.id} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ machine })(({ machine }) => {
          let deleted = machine.data.status === 'terminated';

          if (
            deleted &&
            location.pathname !== path() &&
            !location.pathname.startsWith(path('logs'))
          )
            return <Navigate to={path()} replace />;

          return (
            <>
              <DeletedRecordCallout status={deleted ? 'deleted' : 'active'} />
              <start.RenderError />
              <pause.RenderError />
              <hibernate.RenderError />
              <restart.RenderError />
              <Outlet />
            </>
          );
        })}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};

export let SandboxMachineLayout = () => (
  <SandboxManagedPage withLayout>
    <SandboxMachineDetailsLayout />
  </SandboxManagedPage>
);
