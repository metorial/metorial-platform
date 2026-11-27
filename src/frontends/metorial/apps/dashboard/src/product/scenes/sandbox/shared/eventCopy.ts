import {
  RiAddCircleLine,
  RiArrowUpCircleLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCodeSSlashLine,
  RiCpuLine,
  RiEditLine,
  RiErrorWarningLine,
  RiFirstAidKitLine,
  RiHardDrive3Line,
  RiHourglassLine,
  RiLinkM,
  RiLinkUnlinkM,
  RiLoopLeftLine,
  RiMoonLine,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiRestartLine,
  RiSkipForwardLine,
  RiStackLine,
  RiStopCircleLine,
  RiSwapLine,
  RiTerminalBoxLine,
  RiTimerLine,
  type RemixiconComponentType
} from '@remixicon/react';
import { formatEnumLabel } from '../lib/format';

export let sandboxMachineEventTypes = [
  'running',
  'failed',
  'paused',
  'terminated',
  'start_requested',
  'start_platform_pending',
  'start_platform_complete',
  'start_initialize_pending',
  'pause_requested',
  'pause_prepare_pending',
  'pause_prepare_complete',
  'pause_platform_pending',
  'resume_requested',
  'resume_platform_pending',
  'resume_platform_complete',
  'resume_initialize_pending',
  'terminate_requested',
  'terminate_prepare_pending',
  'terminate_prepare_complete',
  'terminate_platform_pending',
  'operation_superseded',
  'operation_aborted',
  'prepare_skipped',
  'guest_hook_started',
  'guest_error',
  'platform_error',
  'platform_hook_reported',
  'microvm_attached',
  'step_redriven',
  'machine_starting',
  'machine_running',
  'machine_pausing',
  'machine_paused',
  'machine_resuming',
  'machine_hibernating',
  'machine_hibernated',
  'machine_restarting',
  'machine_upgrading',
  'machine_terminating',
  'machine_terminated',
  'machine_failed',
  'rootfs_selected',
  'rootfs_ready',
  'rootfs_failed',
  'rootfs_activated',
  'rootfs_cancelled',
  'rootfs_deleted',
  'machine_created',
  'machine_updated',
  'machine_policy_updated',
  'machine_operation_superseded',
  'instance_created',
  'instance_expiring',
  'machine_disk_attached',
  'machine_disk_detached',
  'disk_wait_started',
  'disk_wait_ended',
  'recovery_scheduled',
  'runtime_setup_started',
  'runtime_setup_succeeded',
  'runtime_setup_failed',
  'runtime_entrypoint_started',
  'runtime_entrypoint_exited',
  'runtime_failed'
] as const;

export type SandboxMachineEventType = (typeof sandboxMachineEventTypes)[number];

export type SandboxMachineEventGroup = 'lifecycle' | 'runtime' | 'disks' | 'errors';

export type SandboxMachineEventSource = 'agent' | 'api' | 'policy' | 'guest' | 'system';

export interface SandboxMachineEventCopy {
  sentence: string;
  icon: RemixiconComponentType;
  isError: boolean;
  group: SandboxMachineEventGroup;
}

type CopyEntry = [
  sentence: string,
  icon: RemixiconComponentType,
  group?: SandboxMachineEventGroup
];

let eventCopy: Record<SandboxMachineEventType, CopyEntry> = {
  running: ['Machine is running', RiPlayCircleLine],
  failed: ['Machine failed', RiErrorWarningLine, 'errors'],
  paused: ['Machine paused', RiPauseCircleLine],
  terminated: ['Machine instance terminated', RiStopCircleLine],

  start_requested: ['Start requested', RiPlayCircleLine],
  start_platform_pending: ['Provisioning the machine', RiCpuLine],
  start_platform_complete: ['Machine provisioned', RiCpuLine],
  start_initialize_pending: ['Initializing the machine', RiPlayCircleLine],

  pause_requested: ['Pause requested', RiPauseCircleLine],
  pause_prepare_pending: ['Preparing to pause', RiPauseCircleLine],
  pause_prepare_complete: ['Ready to pause', RiPauseCircleLine],
  pause_platform_pending: ['Saving machine state', RiPauseCircleLine],

  resume_requested: ['Resume requested', RiPlayCircleLine],
  resume_platform_pending: ['Restoring machine state', RiPlayCircleLine],
  resume_platform_complete: ['Machine state restored', RiPlayCircleLine],
  resume_initialize_pending: ['Reinitializing the machine', RiPlayCircleLine],

  terminate_requested: ['Termination requested', RiStopCircleLine],
  terminate_prepare_pending: ['Preparing to terminate', RiStopCircleLine],
  terminate_prepare_complete: ['Ready to terminate', RiStopCircleLine],
  terminate_platform_pending: ['Releasing machine resources', RiStopCircleLine],

  operation_superseded: ['Operation replaced by a newer request', RiSwapLine],
  operation_aborted: ['Operation aborted', RiCloseCircleLine],
  prepare_skipped: ['Preparation skipped', RiSkipForwardLine],

  guest_hook_started: ['Hook started', RiCodeSSlashLine, 'runtime'],
  guest_error: ['Error reported inside the machine', RiErrorWarningLine, 'errors'],
  platform_error: ['Platform error', RiErrorWarningLine, 'errors'],
  platform_hook_reported: ['Hook reported', RiCodeSSlashLine, 'runtime'],
  microvm_attached: ['Virtual machine attached', RiCpuLine],
  step_redriven: ['Step retried', RiLoopLeftLine],

  machine_starting: ['Machine starting', RiPlayCircleLine],
  machine_running: ['Machine ready', RiPlayCircleLine],
  machine_pausing: ['Machine pausing', RiPauseCircleLine],
  machine_paused: ['Machine paused', RiPauseCircleLine],
  machine_resuming: ['Machine resuming', RiPlayCircleLine],
  machine_hibernating: ['Machine hibernating', RiMoonLine],
  machine_hibernated: ['Machine hibernated', RiMoonLine],
  machine_restarting: ['Machine restarting', RiRestartLine],
  machine_upgrading: ['Machine upgrading', RiArrowUpCircleLine],
  machine_terminating: ['Machine terminating', RiStopCircleLine],
  machine_terminated: ['Machine terminated', RiStopCircleLine],
  machine_failed: ['Machine failed', RiErrorWarningLine, 'errors'],

  rootfs_selected: ['Image version selected', RiStackLine, 'disks'],
  rootfs_ready: ['Root disk ready', RiHardDrive3Line, 'disks'],
  rootfs_failed: ['Root disk failed', RiErrorWarningLine, 'errors'],
  rootfs_activated: ['Root disk activated', RiHardDrive3Line, 'disks'],
  rootfs_cancelled: ['Root disk preparation cancelled', RiCloseCircleLine, 'disks'],
  rootfs_deleted: ['Root disk deleted', RiHardDrive3Line, 'disks'],

  machine_created: ['Machine created', RiAddCircleLine],
  machine_updated: ['Settings updated', RiEditLine],
  machine_policy_updated: ['Lifecycle policy updated', RiTimerLine],
  machine_operation_superseded: ['Pending operation replaced', RiSwapLine],

  instance_created: ['New boot created', RiRestartLine],
  instance_expiring: ['Boot reaching its lifetime limit', RiHourglassLine],

  machine_disk_attached: ['Disk attached', RiLinkM, 'disks'],
  machine_disk_detached: ['Disk detached', RiLinkUnlinkM, 'disks'],
  disk_wait_started: ['Waiting for a disk', RiHourglassLine, 'disks'],
  disk_wait_ended: ['Disk available', RiHardDrive3Line, 'disks'],

  recovery_scheduled: ['Recovery scheduled', RiFirstAidKitLine],

  runtime_setup_started: ['Setup command started', RiTerminalBoxLine, 'runtime'],
  runtime_setup_succeeded: ['Setup command finished', RiCheckboxCircleLine, 'runtime'],
  runtime_setup_failed: ['Setup command failed', RiErrorWarningLine, 'errors'],
  runtime_entrypoint_started: ['Start command running', RiTerminalBoxLine, 'runtime'],
  runtime_entrypoint_exited: ['Start command exited', RiTerminalBoxLine, 'runtime'],
  runtime_failed: ['Runtime failed', RiErrorWarningLine, 'errors']
};

export let getSandboxMachineEventCopy = (
  type: SandboxMachineEventType | string
): SandboxMachineEventCopy => {
  let entry = eventCopy[type as SandboxMachineEventType];

  if (!entry) {
    let isError = /(^|_)(failed|error)$/.test(type);

    return {
      sentence: formatEnumLabel(type),
      icon: isError ? RiErrorWarningLine : RiTerminalBoxLine,
      isError,
      group: isError ? 'errors' : 'lifecycle'
    };
  }

  let [sentence, icon, group = 'lifecycle'] = entry;

  return { sentence, icon, isError: group == 'errors', group };
};

export let sandboxMachineEventGroups: {
  id: SandboxMachineEventGroup;
  label: string;
  types: SandboxMachineEventType[];
}[] = (
  [
    ['lifecycle', 'Lifecycle'],
    ['runtime', 'Runtime'],
    ['disks', 'Disks'],
    ['errors', 'Errors']
  ] as const
).map(([id, label]) => ({
  id,
  label,
  types: sandboxMachineEventTypes.filter(type => getSandboxMachineEventCopy(type).group == id)
}));

let eventSourceLabels: Record<SandboxMachineEventSource, string> = {
  agent: 'Agent',
  api: 'API',
  policy: 'Policy',
  guest: 'Machine',
  system: 'System'
};

export let getSandboxMachineEventSourceLabel = (source: SandboxMachineEventSource | string) =>
  eventSourceLabels[source as SandboxMachineEventSource] ?? formatEnumLabel(source);
