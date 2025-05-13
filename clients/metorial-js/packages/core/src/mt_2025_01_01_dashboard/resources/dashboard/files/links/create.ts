import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardFilesLinksCreateOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardFilesLinksCreateOutput =
  mtMap.object<DashboardFilesLinksCreateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardFilesLinksCreateBody = { expiresAt?: Date | undefined };

export let mapDashboardFilesLinksCreateBody =
  mtMap.object<DashboardFilesLinksCreateBody>({
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

