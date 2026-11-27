export let versionStatusColors: Record<string, 'green' | 'blue' | 'red' | 'gray'> = {
  active: 'green',
  unavailable: 'gray',
  pending: 'gray',
  deploying: 'blue',
  discovering: 'blue',
  deployment_failed: 'red',
  discovery_failed: 'red'
};

export let deploymentStatusColors: Record<string, 'green' | 'blue' | 'red' | 'gray'> = {
  pending: 'gray',
  running: 'blue',
  succeeded: 'green',
  failed: 'red'
};

export let discoveryStatusColors: Record<string, 'green' | 'red' | 'gray'> = {
  succeeded: 'green',
  failed: 'red'
};

export let eventTypeColors: Record<string, 'green' | 'blue' | 'red' | 'gray' | 'purple'> = {
  deployment_started: 'blue',
  deployment_succeeded: 'green',
  deployment_failed: 'red',
  discovery_started: 'blue',
  discovery_succeeded: 'green',
  discovery_failed: 'red',
  version_pulled: 'gray',
  version_set_as_current: 'purple'
};
