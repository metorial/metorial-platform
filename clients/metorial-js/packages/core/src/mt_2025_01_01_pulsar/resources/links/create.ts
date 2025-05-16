import { mtMap } from '@metorial/util-resource-mapper';

export type LinksCreateOutput = {
  id: string;
  fileId: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
};

export let mapLinksCreateOutput = mtMap.object<LinksCreateOutput>({
  id: mtMap.objectField('id', mtMap.passthrough()),
  fileId: mtMap.objectField('file_id', mtMap.passthrough()),
  url: mtMap.objectField('url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

export type LinksCreateBody = { expiresAt?: Date | undefined };

export let mapLinksCreateBody = mtMap.object<LinksCreateBody>({
  expiresAt: mtMap.objectField('expires_at', mtMap.date())
});

