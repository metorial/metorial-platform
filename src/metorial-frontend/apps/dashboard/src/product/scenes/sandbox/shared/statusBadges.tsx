import { Badge, type BadgeSize } from '@metorial/ui';
import { formatEnumLabel } from '../lib/format';

export type SandboxStatusTone = 'blue' | 'green' | 'orange' | 'gray' | 'red';

export interface SandboxStatusPresentation {
  label: string;
  tone: SandboxStatusTone;
  isTransitional: boolean;
}

export type SandboxMachineStatus =
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'hibernating'
  | 'hibernated'
  | 'restarting'
  | 'upgrading'
  | 'terminating'
  | 'terminated'
  | 'failed';

export type SandboxImageBuildStatus =
  | 'preparing'
  | 'queued'
  | 'building'
  | 'processing'
  | 'replicating'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type SandboxDiskStatus = 'active' | 'cloning' | 'deleting' | 'deleted' | 'sealed';

export type SandboxDiskResizeStatus =
  'pending' | 'draining' | 'resizing' | 'verifying' | 'restarting' | 'complete' | 'failed';

export type SandboxMountStatus =
  | 'failed'
  | 'pending'
  | 'mounted'
  | 'recovering'
  | 'skipped'
  | 'released'
  | 'waiting'
  | 'detaching'
  | 'idle';

export type SandboxImageStatus = 'pending' | 'active' | 'deleted';

export type SandboxOperationKind = 'start' | 'pause' | 'hibernate' | 'restart' | 'terminate';

export type SandboxOperationTrigger =
  | 'api'
  | 'access'
  | 'idle_policy'
  | 'paused_policy'
  | 'lifetime'
  | 'failure'
  | 'platform'
  | 'update';

type ToneMap = {
  blue?: readonly string[];
  green?: readonly string[];
  orange?: readonly string[];
  gray?: readonly string[];
  red?: readonly string[];
};

let present = (
  status: string,
  tones: ToneMap,
  labels: Record<string, string> = {}
): SandboxStatusPresentation => {
  let tone = (Object.keys(tones) as SandboxStatusTone[]).find(t => tones[t]?.includes(status));

  return {
    label: labels[status] ?? formatEnumLabel(status),
    tone: tone ?? 'gray',
    isTransitional: tone == 'orange'
  };
};

let machineTones = {
  green: ['running'],
  orange: [
    'starting',
    'resuming',
    'restarting',
    'upgrading',
    'pausing',
    'hibernating',
    'terminating'
  ],
  gray: ['paused', 'hibernated', 'terminated'],
  red: ['failed']
} as const;

let buildTones = {
  blue: ['succeeded'],
  orange: ['building', 'processing', 'replicating'],
  gray: ['preparing', 'queued', 'cancelled'],
  red: ['failed', 'timed_out']
} as const;

let diskTones = {
  green: ['active'],
  orange: ['cloning', 'deleting'],
  gray: ['sealed', 'deleted']
} as const;

let resizeTones = {
  green: ['complete'],
  orange: ['pending', 'draining', 'resizing', 'verifying', 'restarting'],
  red: ['failed']
} as const;

let mountTones = {
  green: ['mounted'],
  orange: ['pending', 'waiting', 'recovering', 'detaching'],
  gray: ['released', 'skipped', 'idle'],
  red: ['failed']
} as const;

let activeBuildStatuses: readonly string[] = [
  'preparing',
  'queued',
  'building',
  'processing',
  'replicating'
];

export let isSandboxMachineTransitional = (status: SandboxMachineStatus | string) =>
  (machineTones.orange as readonly string[]).includes(status);

export let isSandboxBuildActive = (
  status: SandboxImageBuildStatus | string | null | undefined
) => !!status && activeBuildStatuses.includes(status);

export let isSandboxResizeActive = (
  status: SandboxDiskResizeStatus | string | null | undefined
) => !!status && (resizeTones.orange as readonly string[]).includes(status);

export let getSandboxMachineStatus = (status: SandboxMachineStatus | string) =>
  present(status, machineTones);

export let getSandboxBuildStatus = (status: SandboxImageBuildStatus | string) =>
  present(status, buildTones, { preparing: 'Queued', queued: 'Queued' });

export let getSandboxDiskStatus = (
  status: SandboxDiskStatus | string,
  opts?: { activeResize?: unknown }
): SandboxStatusPresentation => {
  if (status == 'active' && opts?.activeResize) {
    return { label: 'Resizing', tone: 'orange', isTransitional: true };
  }

  return present(status, diskTones);
};

export let getSandboxResizeStatus = (status: SandboxDiskResizeStatus | string) =>
  present(status, resizeTones);

export let getSandboxMountStatus = (status: SandboxMountStatus | string) =>
  present(status, mountTones);

export let getSandboxImageStatus = (
  status: SandboxImageStatus | string,
  opts?: { latestBuildStatus?: SandboxImageBuildStatus | string | null }
): SandboxStatusPresentation | null => {
  let latestBuildStatus = opts?.latestBuildStatus;

  if (status == 'deleted') return { label: 'Deleted', tone: 'gray', isTransitional: false };

  if (isSandboxBuildActive(latestBuildStatus)) {
    return { label: 'Building', tone: 'orange', isTransitional: true };
  }

  if (status == 'active') return null;

  if (latestBuildStatus == 'failed' || latestBuildStatus == 'timed_out') {
    return { label: 'Build Failed', tone: 'red', isTransitional: false };
  }

  return { label: 'No Version', tone: 'gray', isTransitional: false };
};

let operationKindLabels: Record<SandboxOperationKind, string> = {
  start: 'Starting',
  pause: 'Pausing',
  hibernate: 'Hibernating',
  restart: 'Restarting',
  terminate: 'Terminating'
};

let operationTriggerLabels: Record<SandboxOperationTrigger, string> = {
  api: 'API',
  access: 'Access',
  idle_policy: 'Idle Policy',
  paused_policy: 'Paused Policy',
  lifetime: 'Lifetime',
  failure: 'Failure',
  platform: 'Platform',
  update: 'Update'
};

export let getSandboxOperationKindLabel = (kind: SandboxOperationKind | string) =>
  operationKindLabels[kind as SandboxOperationKind] ?? formatEnumLabel(kind);

export let getSandboxOperationTriggerLabel = (trigger: SandboxOperationTrigger | string) =>
  operationTriggerLabels[trigger as SandboxOperationTrigger] ?? formatEnumLabel(trigger);

let gapSizes: Record<BadgeSize, number> = { '1': 4, '2': 6, '3': 8 };

export let SandboxStatusBadge = ({
  status,
  size = '2'
}: {
  status: SandboxStatusPresentation | null;
  size?: BadgeSize;
}) => {
  if (!status) return null;

  return (
    <Badge
      color={status.tone}
      size={size}
      loading={status.isTransitional}
      style={{ gap: gapSizes[size], whiteSpace: 'nowrap' }}
    >
      {status.label}
    </Badge>
  );
};

type BadgeSizeProps = { size?: BadgeSize };

export let SandboxMachineStatusBadge = ({
  status,
  size
}: { status: SandboxMachineStatus | string } & BadgeSizeProps) => (
  <SandboxStatusBadge status={getSandboxMachineStatus(status)} size={size} />
);

export let SandboxBuildStatusBadge = ({
  status,
  size
}: { status: SandboxImageBuildStatus | string } & BadgeSizeProps) => (
  <SandboxStatusBadge status={getSandboxBuildStatus(status)} size={size} />
);

export let SandboxDiskStatusBadge = ({
  status,
  activeResize,
  size
}: { status: SandboxDiskStatus | string; activeResize?: unknown } & BadgeSizeProps) => (
  <SandboxStatusBadge status={getSandboxDiskStatus(status, { activeResize })} size={size} />
);

export let SandboxResizeStatusBadge = ({
  status,
  size
}: { status: SandboxDiskResizeStatus | string } & BadgeSizeProps) => (
  <SandboxStatusBadge status={getSandboxResizeStatus(status)} size={size} />
);

export let SandboxMountStatusBadge = ({
  status,
  size
}: { status: SandboxMountStatus | string } & BadgeSizeProps) => (
  <SandboxStatusBadge status={getSandboxMountStatus(status)} size={size} />
);

export let SandboxImageStatusBadge = ({
  status,
  latestBuildStatus,
  size
}: {
  status: SandboxImageStatus | string;
  latestBuildStatus?: SandboxImageBuildStatus | string | null;
} & BadgeSizeProps) => (
  <SandboxStatusBadge
    status={getSandboxImageStatus(status, { latestBuildStatus })}
    size={size}
  />
);
