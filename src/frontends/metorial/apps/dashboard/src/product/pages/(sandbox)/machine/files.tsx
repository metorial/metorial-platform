import { renderWithLoader } from '@metorial/data-hooks';
import { FileBrowser, normalizePath } from '@metorial/file-browser';
import { Paths } from '@metorial/frontend-config';
import {
  createSandboxMachineAccess,
  useCurrentInstance,
  useSandboxMachine
} from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  createSandboxFilesAdapter,
  getFileBrowserStatus
} from '../../../scenes/sandbox/access';
import {
  SandboxMachineToolGate,
  SandboxToolViewport
} from '../../../scenes/sandbox/terminal/toolGate';

let MachineFiles = ({ instanceId, machineId }: { instanceId: string; machineId: string }) => {
  let instance = useCurrentInstance();
  let machine = useSandboxMachine(instanceId, machineId);
  let [params, setParams] = useSearchParams();

  let adapter = useMemo(
    () =>
      createSandboxFilesAdapter({
        getAccess: () => createSandboxMachineAccess({ instanceId, machineId, scope: 'files' })
      }),
    [instanceId, machineId]
  );
  let snapshot = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  let mountedAdapter = useRef<typeof adapter | null>(null);

  useEffect(() => {
    mountedAdapter.current = adapter;

    return () => {
      mountedAdapter.current = null;

      // Strict Mode replays setup before this microtask, retaining the active adapter.
      queueMicrotask(() => {
        if (mountedAdapter.current !== adapter) adapter.close();
      });
    };
  }, [adapter]);

  return renderWithLoader({ machine })(({ machine }) => (
    <SandboxMachineToolGate instanceId={instanceId} machineId={machineId} action="Browse">
      <FileBrowser
        adapter={adapter}
        height="100%"
        status={getFileBrowserStatus(snapshot.status)}
        onReconnect={() => adapter.reconnect()}
        path={normalizePath(params.get('path') || '/')}
        onPathChange={path =>
          setParams(
            previous => {
              let next = new URLSearchParams(previous);
              next.set('path', path);
              return next;
            },
            { replace: true }
          )
        }
        renderBadge={entry => {
          let mount = machine.data.mounts.find(m => normalizePath(m.mountPath) == entry.path);
          return mount ? (
            <Link
              to={Paths.instance.sandboxDisk(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                mount.diskId
              )}
              onClick={e => e.stopPropagation()}
            >
              <Badge color="gray">Disk</Badge>
            </Link>
          ) : null;
        }}
      />
    </SandboxMachineToolGate>
  ));
};

export let SandboxMachineFilesPage = () => {
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  return renderWithLoader({ instance })(({ instance }) => (
    <SandboxToolViewport>
      {machineId && (
        <MachineFiles key={machineId} instanceId={instance.data.id} machineId={machineId} />
      )}
    </SandboxToolViewport>
  ));
};
