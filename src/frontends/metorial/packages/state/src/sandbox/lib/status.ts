export let sandboxMachineTransitionalStatuses = [
  'starting',
  'resuming',
  'restarting',
  'upgrading',
  'pausing',
  'hibernating',
  'terminating'
] as const;

export let sandboxDiskTransitionalStatuses = ['cloning', 'deleting'] as const;

export let sandboxDiskResizeActiveStatuses = [
  'pending',
  'draining',
  'resizing',
  'verifying',
  'restarting'
] as const;

export let sandboxImageBuildActiveStatuses = [
  'preparing',
  'queued',
  'building',
  'processing',
  'replicating'
] as const;

export let isSandboxMachineBusy = (machine: { status: string; operation: unknown | null }) =>
  machine.operation !== null ||
  (sandboxMachineTransitionalStatuses as readonly string[]).includes(machine.status);

export let isSandboxDiskBusy = (disk: { status: string; activeResize: unknown | null }) =>
  disk.activeResize !== null ||
  (sandboxDiskTransitionalStatuses as readonly string[]).includes(disk.status);

export let isSandboxDiskResizeActive = (resize: { status: string }) =>
  (sandboxDiskResizeActiveStatuses as readonly string[]).includes(resize.status);

export let isSandboxImageBuildActive = (build: { status: string }) =>
  (sandboxImageBuildActiveStatuses as readonly string[]).includes(build.status);
