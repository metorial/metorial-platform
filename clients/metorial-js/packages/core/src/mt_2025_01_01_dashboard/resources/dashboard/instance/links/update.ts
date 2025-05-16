import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceLinksUpdateOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapDashboardInstanceLinksUpdateOutput =
  mtMap.object<DashboardInstanceLinksUpdateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    fileId: mtMap.objectField('file_id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceLinksUpdateBody = { expiresAt?: Date | undefined };

export let mapDashboardInstanceLinksUpdateBody =
  mtMap.object<DashboardInstanceLinksUpdateBody>({
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

