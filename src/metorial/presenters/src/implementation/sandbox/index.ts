import { checkEdition } from '@metorial/editions';

let cloud = checkEdition('cloud') ? await import('./cloud') : ({} as typeof import('./cloud'));

export let v1SandboxMachineUsageSummaryPresenter = cloud.v1SandboxMachineUsageSummaryPresenter;

export let v1SandboxDiskMountPresenter = cloud.v1SandboxDiskMountPresenter;

export let v1SandboxMachineInstancePresenter = cloud.v1SandboxMachineInstancePresenter;

export let v1SandboxImagePresenter = cloud.v1SandboxImagePresenter;

export let v1SandboxImageVersionPresenter = cloud.v1SandboxImageVersionPresenter;

export let v1SandboxMachineUsagePresenter = cloud.v1SandboxMachineUsagePresenter;

export let v1SandboxDiskResizePresenter = cloud.v1SandboxDiskResizePresenter;

export let v1SandboxMachineExecResultPresenter = cloud.v1SandboxMachineExecResultPresenter;

export let v1SandboxMachinePresenter = cloud.v1SandboxMachinePresenter;

export let v1SandboxLogLinesPresenter = cloud.v1SandboxLogLinesPresenter;

export let v1SandboxSpecPresenter = cloud.v1SandboxSpecPresenter;

export let v1SandboxMachineUsageTimelinePresenter =
  cloud.v1SandboxMachineUsageTimelinePresenter;

export let v1SandboxRegionPresenter = cloud.v1SandboxRegionPresenter;

export let v1SandboxMachineEventPresenter = cloud.v1SandboxMachineEventPresenter;

export let v1SandboxMachineOperationPresenter = cloud.v1SandboxMachineOperationPresenter;

export let v1SandboxMachineErrorPresenter = cloud.v1SandboxMachineErrorPresenter;

export let v1SandboxDiskPresenter = cloud.v1SandboxDiskPresenter;

export let v1SandboxMachineAccessPresenter = cloud.v1SandboxMachineAccessPresenter;

export let v1SandboxImageBuildPresenter = cloud.v1SandboxImageBuildPresenter;
