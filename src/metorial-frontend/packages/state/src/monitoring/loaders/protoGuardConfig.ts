import {
  DashboardInstanceProtoGuardConfigGetOutput,
  DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
  DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput,
  DashboardInstanceProtoGuardConfigUpdateBody,
  DashboardInstanceProtoGuardConfigUpdateOutput,
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
    update: (
      body: DashboardInstanceProtoGuardConfigUpdateBody,
      { input: { instanceId } }
    ): Promise<DashboardInstanceProtoGuardConfigUpdateOutput> =>
      withAuth(sdk => (sdk as any).protoGuardConfig.update(instanceId, body)),

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
    updateMutator: data.useMutator('update'),
    updateFilterMutator: data.useMutator('updateFilter'),
    setAlertFilterCountThresholdMutator: data.useMutator('setAlertFilterCountThreshold')
  };
};
