import {
  DashboardInstanceProtoGuardConfigGetOutput,
  DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
  DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput,
  DashboardInstanceProtoGuardConfigUpdateFilterBody,
  DashboardInstanceProtoGuardConfigUpdateFilterOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let protoGuardConfigLoader = createLoader({
  name: 'protoGuardConfig',
  parents: [],
  fetch: (i: { instanceId: string }): Promise<DashboardInstanceProtoGuardConfigGetOutput> =>
    withAuth(sdk => (sdk as any).protoGuardConfig.get(i.instanceId)),
  mutators: {
    updateFilter: (
      input: { filterId: string } & DashboardInstanceProtoGuardConfigUpdateFilterBody,
      { input: { instanceId } }
    ): Promise<DashboardInstanceProtoGuardConfigUpdateFilterOutput> => {
      let { filterId, ...body } = input;
      return withAuth(sdk =>
        (sdk as any).protoGuardConfig.updateFilter(instanceId, filterId, body)
      );
    },
    setAlertFilterCountThreshold: (
      body: DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
      { input: { instanceId } }
    ): Promise<DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput> =>
      withAuth(sdk =>
        (sdk as any).protoGuardConfig.setAlertFilterCountThreshold(instanceId, body)
      )
  }
});

export let useProtoGuardConfig = (instanceId: string | null | undefined) => {
  let data = protoGuardConfigLoader.use(instanceId ? { instanceId } : null);

  return {
    ...data,
    updateFilterMutator: data.useMutator('updateFilter'),
    setAlertFilterCountThresholdMutator: data.useMutator('setAlertFilterCountThreshold')
  };
};
