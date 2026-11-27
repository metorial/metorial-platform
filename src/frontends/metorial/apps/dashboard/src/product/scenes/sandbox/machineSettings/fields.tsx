import { renderWithLoader } from '@metorial/data-hooks';
import {
  useFirewall,
  useFirewalls,
  useSandboxDisk,
  useSandboxDisks,
  useSandboxSpecs
} from '@metorial/state';
import {
  Button,
  Callout,
  Combobox,
  DurationInput,
  Flex,
  Input,
  NumberInput,
  Select,
  Slider,
  Text
} from '@metorial/ui';
import { useEffect, useState } from 'react';

export type DiskMount = { diskId: string; mountPath: string };
export let SandboxSizeField = (p: {
  instanceId?: string;
  region: string;
  value: string;
  currentValue?: string;
  onChange: (id: string) => void;
}) => {
  let specs = useSandboxSpecs(p.instanceId);
  let [dimensions, setDimensions] = useState<{ cpus: number; memory: number } | null>(null);
  let [selectionRegion, setSelectionRegion] = useState(p.region);
  let regionSpecs = specs.data?.items.filter(s => s.regions.includes(p.region)) ?? [];
  let selected = regionSpecs.find(s => s.id === (p.value || p.currentValue));

  useEffect(() => {
    if (selectionRegion !== p.region) {
      setSelectionRegion(p.region);
      setDimensions(null);
      return;
    }
    if (dimensions) return;
    let initial =
      selected ??
      [...regionSpecs]
        .filter(s => s.available)
        .sort((a, b) => a.cpus - b.cpus || a.memoryGib - b.memoryGib)[0];
    if (!initial) return;

    setDimensions({ cpus: initial.cpus, memory: initial.memoryGib });
    p.onChange(initial.available ? initial.id : '');
  }, [specs.data, p.region, selectionRegion, dimensions, selected, p.onChange]);

  let choose = (next: { cpus: number; memory: number }) => {
    setDimensions(next);
    let spec = regionSpecs.find(
      s => s.cpus === next.cpus && s.memoryGib === next.memory && s.available
    );
    p.onChange(spec?.id ?? '');
  };
  let valid =
    dimensions &&
    regionSpecs.some(
      s => s.available && s.cpus === dimensions.cpus && s.memoryGib === dimensions.memory
    );

  return renderWithLoader({ specs })(({ specs }) => (
    <Flex direction="column" gap={15}>
      <Slider
        label="vCPU"
        value={dimensions?.cpus}
        disabled={!dimensions}
        stops={[...new Set(specs.data.items.map(s => s.cpus))]
          .sort((a, b) => a - b)
          .map(value => ({
            value,
            label: String(value),
            disabled: !regionSpecs.some(s => s.available && s.cpus === value)
          }))}
        onChange={cpus => dimensions && choose({ ...dimensions, cpus })}
      />
      <Slider
        label="Memory"
        unit="GiB"
        value={dimensions?.memory}
        disabled={!dimensions}
        stops={[...new Set(specs.data.items.map(s => s.memoryGib))]
          .sort((a, b) => a - b)
          .map(value => ({
            value,
            label: `${value} GiB`,
            disabled: !regionSpecs.some(s => s.available && s.memoryGib === value)
          }))}
        onChange={memory => dimensions && choose({ ...dimensions, memory })}
      />
      {!valid && (
        <Callout color="orange" variant="inline">
          {dimensions
            ? 'This CPU and memory combination is unavailable. Choose a different size.'
            : 'No machine sizes are available in this region.'}
        </Callout>
      )}
    </Flex>
  ));
};

let MountRow = (p: {
  instanceId?: string;
  region: string;
  mount: DiskMount;
  usedIds: string[];
  onChange: (mount: DiskMount) => void;
  onRemove: () => void;
}) => {
  let selected = useSandboxDisk(p.instanceId, p.mount.diskId || undefined);
  return (
    <Flex gap={15} align="end">
      <Combobox
        label="Disk"
        value={p.mount.diskId || null}
        valueLabel={selected.data?.name || p.mount.diskId}
        placeholder="Search disks"
        provider={({ searchQuery }) => {
          let disks = useSandboxDisks(p.instanceId, {
            type: 'standard',
            attached: false,
            region: p.region,
            search: searchQuery,
            limit: 25
          });
          return {
            items: (disks.data?.items ?? [])
              .filter(
                d =>
                  d.status === 'active' &&
                  (!p.usedIds.includes(d.id) || d.id === p.mount.diskId)
              )
              .map(d => ({ id: d.id, label: d.name || 'Untitled disk', description: d.id })),
            isLoading: disks.isLoading,
            empty: 'No unattached disks in this region.'
          };
        }}
        onChange={id => p.onChange({ ...p.mount, diskId: id ?? '' })}
      />
      <Input
        label="Mount Path"
        value={p.mount.mountPath}
        onChange={e => p.onChange({ ...p.mount, mountPath: e.target.value })}
      />
      <Button size="3" type="button" variant="outline" onClick={p.onRemove}>
        Remove
      </Button>
    </Flex>
  );
};

export let SandboxMountsField = (p: {
  instanceId?: string;
  region: string;
  value: DiskMount[];
  hideAddButton?: boolean;
  onChange: (value: DiskMount[]) => void;
}) => (
  <Flex direction="column" gap={15}>
    {p.value.map((mount, index) => (
      <MountRow
        key={index}
        {...p}
        mount={mount}
        usedIds={p.value.map(m => m.diskId)}
        onChange={next => p.onChange(p.value.map((m, i) => (i === index ? next : m)))}
        onRemove={() => p.onChange(p.value.filter((_, i) => i !== index))}
      />
    ))}
    {!p.hideAddButton && (
      <Button
        style={{ alignSelf: 'flex-start' }}
        size="2"
        type="button"
        variant="outline"
        disabled={p.value.length >= 3}
        onClick={() => p.onChange([...p.value, { diskId: '', mountPath: '/data' }])}
      >
        Add Disk
      </Button>
    )}
  </Flex>
);
export type LifecyclePolicy = {
  pauseAfterIdleSeconds: number | null;
  hibernateAfterPausedSeconds: number | null;
  connectionIdleSeconds: number | null;
};

export let SandboxLifecycleField = (p: {
  value: LifecyclePolicy;
  onChange: (value: LifecyclePolicy) => void;
}) => (
  <Flex direction="column" gap={15}>
    <DurationInput
      label="Pause After Idle"
      min={10}
      allowNever
      value={p.value.pauseAfterIdleSeconds}
      onChange={value => p.onChange({ ...p.value, pauseAfterIdleSeconds: value })}
    />
    <DurationInput
      label="Hibernate After Paused"
      min={10}
      allowNever
      value={p.value.hibernateAfterPausedSeconds}
      onChange={value => p.onChange({ ...p.value, hibernateAfterPausedSeconds: value })}
    />
    {!p.value.pauseAfterIdleSeconds && !!p.value.hibernateAfterPausedSeconds && (
      <Callout color="gray" variant="inline">
        Pausing is disabled, so the machine will hibernate directly once it has been idle for
        the hibernate time.
      </Callout>
    )}
    {p.value.hibernateAfterPausedSeconds === null && (
      <Callout color="orange" variant="inline">
        Machines may require a mandatory restart after 8 hours or more.
      </Callout>
    )}
  </Flex>
);
let FirewallPicker = (p: {
  instanceId?: string;
  selected: string[];
  onAdd: (id: string) => void;
}) => {
  let provider = ({ searchQuery }: { searchQuery?: string }) => {
    let firewalls = useFirewalls(p.instanceId, {
      limit: 25,
      order: 'desc',
      status: 'active',
      search: searchQuery
    });

    return {
      items: (firewalls.data?.items ?? [])
        .filter(firewall => !p.selected.includes(firewall.id))
        .map(firewall => ({
          id: firewall.id,
          label: firewall.name,
          description: firewall.description
        })),
      isLoading: firewalls.isLoading,
      status: firewalls.error ? 'Unable to load firewalls.' : undefined,
      empty: searchQuery ? 'No matching firewalls found.' : 'No firewalls available to add.'
    };
  };

  return (
    <Combobox
      label="Add Firewall"
      value={null}
      placeholder="Search firewalls"
      provider={provider}
      onChange={id => {
        if (id && !p.selected.includes(id)) p.onAdd(id);
      }}
    />
  );
};

let SelectedFirewall = (p: { instanceId?: string; id: string; onRemove: () => void }) => {
  let firewall = useFirewall(p.instanceId, p.id);
  return (
    <Flex gap={8} align="center">
      <Text>{firewall.data?.name || p.id}</Text>
      <Button size="2" type="button" variant="outline" onClick={p.onRemove}>
        Remove
      </Button>
    </Flex>
  );
};

export let SandboxNetworkField = (p: {
  instanceId?: string;
  firewallIds: string[];
  publicPorts: number[];
  hideAddPortButton?: boolean;
  onFirewallsChange: (ids: string[]) => void;
  onPortsChange: (ports: number[]) => void;
}) => (
  <Flex direction="column" gap={15}>
    {p.firewallIds.map(id => (
      <SelectedFirewall
        key={id}
        id={id}
        instanceId={p.instanceId}
        onRemove={() => p.onFirewallsChange(p.firewallIds.filter(i => i !== id))}
      />
    ))}
    <FirewallPicker
      instanceId={p.instanceId}
      selected={p.firewallIds}
      onAdd={id => {
        if (id) p.onFirewallsChange([...p.firewallIds, id]);
      }}
    />
    {p.publicPorts.map((port, i) => (
      <Flex key={i} gap={10} align="end">
        <NumberInput
          label="Public Port"
          format={{ useGrouping: false }}
          min={1}
          max={65535}
          step={1}
          value={port}
          onChange={value =>
            p.onPortsChange(p.publicPorts.map((n, j) => (i === j ? (value ?? 1) : n)))
          }
        />
        <Button
          size="3"
          type="button"
          variant="outline"
          onClick={() => p.onPortsChange(p.publicPorts.filter((_, j) => i !== j))}
        >
          Remove
        </Button>
      </Flex>
    ))}
    {!p.hideAddPortButton && (
      <Button
        style={{ alignSelf: 'flex-start' }}
        size="2"
        type="button"
        variant="outline"
        onClick={() => p.onPortsChange([...p.publicPorts, 3000])}
      >
        Add Public Port
      </Button>
    )}
  </Flex>
);
