import { checkEdition } from '@metorial/editions';

export type * from './cloud';

let cloud = checkEdition('cloud') ? await import('./cloud') : ({} as typeof import('./cloud'));

export let sandboxMachineTransitionalStatuses = cloud.sandboxMachineTransitionalStatuses;

export let sandboxDiskTransitionalStatuses = cloud.sandboxDiskTransitionalStatuses;

export let sandboxDiskResizeActiveStatuses = cloud.sandboxDiskResizeActiveStatuses;

export let sandboxImageBuildActiveStatuses = cloud.sandboxImageBuildActiveStatuses;

export let isSandboxMachineBusy = cloud.isSandboxMachineBusy;

export let isSandboxDiskBusy = cloud.isSandboxDiskBusy;

export let isSandboxDiskResizeActive = cloud.isSandboxDiskResizeActive;

export let isSandboxImageBuildActive = cloud.isSandboxImageBuildActive;

export let useSandboxPolling = cloud.useSandboxPolling;

export let resolveSandboxRegion = cloud.resolveSandboxRegion;

export let useSandboxRegionSelection = cloud.useSandboxRegionSelection;

export let sandboxMachineUsageTimelineLoader = cloud.sandboxMachineUsageTimelineLoader;

export let useSandboxMachineUsageTimeline = cloud.useSandboxMachineUsageTimeline;

export let sandboxMachineUsageSummaryLoader = cloud.sandboxMachineUsageSummaryLoader;

export let useSandboxMachineUsageSummary = cloud.useSandboxMachineUsageSummary;

export let sandboxImageVersionsLoader = cloud.sandboxImageVersionsLoader;

export let useSandboxImageVersions = cloud.useSandboxImageVersions;

export let sandboxImageVersionLoader = cloud.sandboxImageVersionLoader;

export let useSandboxImageVersion = cloud.useSandboxImageVersion;

export let sandboxImageBuildsLoader = cloud.sandboxImageBuildsLoader;

export let useSandboxImageBuilds = cloud.useSandboxImageBuilds;

export let sandboxImageBuildsForImageLoader = cloud.sandboxImageBuildsForImageLoader;

export let useSandboxImageBuildsForImage = cloud.useSandboxImageBuildsForImage;

export let sandboxImagesLoader = cloud.sandboxImagesLoader;

export let useCreateSandboxImage = cloud.useCreateSandboxImage;

export let useSandboxImages = cloud.useSandboxImages;

export let sandboxImageLoader = cloud.sandboxImageLoader;

export let useStartSandboxImageBuild = cloud.useStartSandboxImageBuild;

export let useSandboxImage = cloud.useSandboxImage;

export let sandboxImageBuildLoader = cloud.sandboxImageBuildLoader;

export let useSandboxImageBuild = cloud.useSandboxImageBuild;

export let useDeleteSandboxImageFromList = cloud.useDeleteSandboxImageFromList;

export let fetchSandboxImageBuildLogs = cloud.fetchSandboxImageBuildLogs;

export let fetchSandboxMachineInstanceLogs = cloud.fetchSandboxMachineInstanceLogs;

export let isSandboxLogsUnavailableError = cloud.isSandboxLogsUnavailableError;

export let sandboxMachineEventsLoader = cloud.sandboxMachineEventsLoader;

export let useSandboxMachineEvents = cloud.useSandboxMachineEvents;

export let sandboxMachineEventLoader = cloud.sandboxMachineEventLoader;

export let useSandboxMachineEvent = cloud.useSandboxMachineEvent;

export let sandboxMachineErrorsLoader = cloud.sandboxMachineErrorsLoader;

export let useSandboxMachineErrors = cloud.useSandboxMachineErrors;

export let sandboxMachineErrorLoader = cloud.sandboxMachineErrorLoader;

export let useSandboxMachineError = cloud.useSandboxMachineError;

export let sandboxMachineOperationsLoader = cloud.sandboxMachineOperationsLoader;

export let useSandboxMachineOperations = cloud.useSandboxMachineOperations;

export let sandboxMachineOperationLoader = cloud.sandboxMachineOperationLoader;

export let useSandboxMachineOperation = cloud.useSandboxMachineOperation;

export let sandboxMachineInstancesLoader = cloud.sandboxMachineInstancesLoader;

export let useSandboxMachineInstances = cloud.useSandboxMachineInstances;

export let sandboxMachineInstanceLoader = cloud.sandboxMachineInstanceLoader;

export let useSandboxMachineInstance = cloud.useSandboxMachineInstance;

export let sandboxDisksLoader = cloud.sandboxDisksLoader;

export let useCreateSandboxDisk = cloud.useCreateSandboxDisk;

export let useSandboxDisks = cloud.useSandboxDisks;

export let sandboxDiskMountsLoader = cloud.sandboxDiskMountsLoader;

export let useSandboxDiskMounts = cloud.useSandboxDiskMounts;

export let sandboxDiskResizesLoader = cloud.sandboxDiskResizesLoader;

export let useSandboxDiskResizes = cloud.useSandboxDiskResizes;

export let sandboxDiskLoader = cloud.sandboxDiskLoader;

export let useSandboxDisk = cloud.useSandboxDisk;

export let sandboxDiskResizeLoader = cloud.sandboxDiskResizeLoader;

export let useSandboxDiskResize = cloud.useSandboxDiskResize;

export let useDeleteSandboxDiskFromList = cloud.useDeleteSandboxDiskFromList;

export let createSandboxMachineAccess = cloud.createSandboxMachineAccess;

export let useCreateSandboxMachineAccess = cloud.useCreateSandboxMachineAccess;

export let sandboxMachinesLoader = cloud.sandboxMachinesLoader;

export let useCreateSandboxMachine = cloud.useCreateSandboxMachine;

export let useSandboxMachines = cloud.useSandboxMachines;

export let sandboxMachineLoader = cloud.sandboxMachineLoader;

export let useSandboxMachine = cloud.useSandboxMachine;

export let useStartSandboxMachineFromList = cloud.useStartSandboxMachineFromList;

export let usePauseSandboxMachineFromList = cloud.usePauseSandboxMachineFromList;

export let useDeleteSandboxMachineFromList = cloud.useDeleteSandboxMachineFromList;

export let sandboxImageBuildContextPurpose = cloud.sandboxImageBuildContextPurpose;

export let sandboxImageBuildContextMaxBytes = cloud.sandboxImageBuildContextMaxBytes;

export let sandboxImageBuildContextExtensions = cloud.sandboxImageBuildContextExtensions;

export let validateSandboxImageBuildContext = cloud.validateSandboxImageBuildContext;

export let uploadSandboxImageBuildContext = cloud.uploadSandboxImageBuildContext;

export let sandboxSpecsLoader = cloud.sandboxSpecsLoader;

export let useSandboxSpecs = cloud.useSandboxSpecs;

export let sandboxRegionsLoader = cloud.sandboxRegionsLoader;

export let useSandboxRegions = cloud.useSandboxRegions;
