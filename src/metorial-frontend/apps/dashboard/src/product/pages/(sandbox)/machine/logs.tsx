import { DetailsSettingsLayout } from '@metorial/details-layout';
import { renderWithLoader } from '@metorial/data-hooks';
import { LogViewer, createStaticLogSource } from '@metorial/log-viewer';
import {
  useCurrentInstance,
  useSandboxMachine,
  useSandboxMachineInstance,
  useSandboxMachineInstances
} from '@metorial/state';
import { Button, Flex, Select } from '@metorial/ui';
import { useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createSandboxMachineLogSource } from '../../../scenes/sandbox/logs/source';
import { SandboxToolViewport } from '../../../scenes/sandbox/terminal/toolGate';

let MachineLogs = ({ instanceId, machineId }: { instanceId: string; machineId: string }) => {
  let machine = useSandboxMachine(instanceId, machineId);
  let bootsLoader = useSandboxMachineInstances(
    instanceId,
    machineId,
    { order: 'desc', limit: 20 },
    { pollInterval: 5000 }
  );

  let [params, setParams] = useSearchParams();
  let selectedId =
    params.get('boot') || machine.data?.currentInstance?.id || bootsLoader.data?.items[0]?.id;
  let selected = useSandboxMachineInstance(instanceId, machineId, selectedId);

  let live = useRef(false);
  let selectedBoot =
    bootsLoader.data?.items.find(boot => boot.id == selectedId) ?? selected.data;
  live.current = selectedBoot ? !selectedBoot.terminatedAt : true;

  let source = useMemo(
    () =>
      selectedId
        ? createSandboxMachineLogSource({
            instanceId,
            machineId,
            machineInstanceId: selectedId,
            isLive: () => live.current
          })
        : createStaticLogSource([]),
    [instanceId, machineId, selectedId]
  );

  return renderWithLoader({ machine, boots: bootsLoader })(({ machine, boots }) => {
    let choices = [...boots.data.items];
    if (selected.data && !choices.some(b => b.id == selected.data?.id))
      choices.push(selected.data);
    let toolbar = (
      <Flex gap={10}>
        <Select
          label="Boot"
          hideLabel
          size="1"
          value={selectedId}
          onChange={id =>
            setParams(previous => {
              let next = new URLSearchParams(previous);
              next.set('boot', id);
              return next;
            })
          }
          items={choices.map(boot => ({
            id: boot.id,
            label: `Boot ${boot.generation}${boot.id == machine.data.currentInstance?.id ? ' · Current' : ''} · ${boot.status}`
          }))}
        />
        {(boots.data.pagination.hasMoreBefore || boots.data.pagination.hasMoreAfter) && (
          <>
            <Button
              size="1"
              variant="ghost"
              disabled={!boots.data.pagination.hasMoreBefore}
              onClick={() => bootsLoader.previous()}
            >
              Newer Boots
            </Button>
            <Button
              size="1"
              variant="ghost"
              disabled={!boots.data.pagination.hasMoreAfter}
              onClick={() => bootsLoader.next()}
            >
              Older Boots
            </Button>
          </>
        )}
      </Flex>
    );
    return (
      <LogViewer
        source={source}
        height="100%"
        toolbarStart={toolbar}
        emptyText={
          selectedId ? 'No console output for this boot.' : 'This machine has never started.'
        }
      />
    );
  });
};

export let SandboxMachineLogsPage = () => {
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  return renderWithLoader({ instance })(({ instance }) => (
    <DetailsSettingsLayout title="Runtime Logs">
      <SandboxToolViewport>
        {machineId && (
          <MachineLogs key={machineId} instanceId={instance.data.id} machineId={machineId} />
        )}
      </SandboxToolViewport>
    </DetailsSettingsLayout>
  ));
};
