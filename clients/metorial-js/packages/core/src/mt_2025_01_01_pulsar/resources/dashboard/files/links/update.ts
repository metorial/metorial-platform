import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardFilesLinksUpdateOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardFilesLinksUpdateOutput =
  mtMap.object<DashboardFilesLinksUpdateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardFilesLinksUpdateBody = { expiresAt?: Date | undefined };

export let mapDashboardFilesLinksUpdateBody =
  mtMap.object<DashboardFilesLinksUpdateBody>({
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

