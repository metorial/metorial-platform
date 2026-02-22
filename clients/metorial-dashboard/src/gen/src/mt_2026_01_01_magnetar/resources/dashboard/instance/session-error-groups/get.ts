import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionErrorGroupsGetOutput = {
  object: 'session.error_group';
  id: string;
  code: string;
  message: string;
  data: Record<string, any>;
  providerId: string | null;
  occurrenceCount: number;
  createdAt: Date;
};

export let mapDashboardInstanceSessionErrorGroupsGetOutput =
  mtMap.object<DashboardInstanceSessionErrorGroupsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    data: mtMap.objectField('data', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    occurrenceCount: mtMap.objectField('occurrence_count', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

