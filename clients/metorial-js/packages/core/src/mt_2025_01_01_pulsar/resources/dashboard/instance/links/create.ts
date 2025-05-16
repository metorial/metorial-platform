import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceLinksCreateOutput = {
  object: 'file.file_link';
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceLinksCreateOutput =
  mtMap.object<DashboardInstanceLinksCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceLinksCreateBody = { expiresAt?: Date | undefined };

export let mapDashboardInstanceLinksCreateBody =
  mtMap.object<DashboardInstanceLinksCreateBody>({
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

