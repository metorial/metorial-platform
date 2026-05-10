import { createClient } from '@lowerdeck/rpc-client';
import type { CargoClient } from '../../../cargo/service/src/controllers';

type RpcClientOpts = Parameters<typeof createClient>[0];
type CargoHeaders = Record<string, string> | Array<[string, string]> | Headers;

export type CargoHttpEndpoints = {
  uploadEndpoint: string;
  contentEndpoint: string;
  headers?: CargoHeaders;
};

export type CargoUploadInput = {
  tenantId: string;
  environmentId: string;
  purpose: string;
  file: Blob;
  fileName: string;
  fileId?: string;
  storeId?: string;
  title?: string;
  actorId?: string;
  defaultPermissions?: Array<'content_read' | 'content_write'>;
  overridePermissions?: boolean;
  store?: {
    id: string;
    path: string;
  };
};

export type CargoUploadResult = {
  object: 'cargo#file';
  id: string;
  status: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  title?: string | null;
  purpose: {
    id: string;
    slug: string;
    name: string;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
};

export let createCargoClient = (o: RpcClientOpts): CargoClient => createClient<CargoClient>(o);

export let getFileDownloadUrl = (d: {
  contentEndpoint: string;
  fileId: string;
  key: string;
}) => `${d.contentEndpoint.replace(/\/$/, '')}/files/${d.fileId}/${d.key}`;

export let uploadFile = async (
  endpoints: CargoHttpEndpoints,
  input: CargoUploadInput
): Promise<CargoUploadResult> => {
  let body = new FormData();

  body.set('tenantId', input.tenantId);
  body.set('environmentId', input.environmentId);
  body.set('purpose', input.purpose);
  body.set('file', input.file, input.fileName);

  if (input.fileId) body.set('fileId', input.fileId);
  if (input.storeId) body.set('storeId', input.storeId);
  if (input.title) body.set('title', input.title);
  if (input.actorId) body.set('actorId', input.actorId);
  if (input.overridePermissions !== undefined) {
    body.set('overridePermissions', input.overridePermissions ? 'true' : 'false');
  }
  if (input.store) {
    body.set('attachedStoreId', input.store.id);
    body.set('attachedStorePath', input.store.path);
  }
  for (let permission of input.defaultPermissions ?? []) {
    body.append('defaultPermissions', permission);
  }

  let response = await fetch(`${endpoints.uploadEndpoint.replace(/\/$/, '')}/files`, {
    method: 'POST',
    body,
    headers: endpoints.headers
  });

  if (!response.ok) {
    throw new Error(`Cargo upload failed with status ${response.status}`);
  }

  return (await response.json()) as CargoUploadResult;
};

export let downloadFile = async (d: {
  contentEndpoint: string;
  fileId: string;
  key: string;
  headers?: CargoHeaders;
}) => {
  let response = await fetch(getFileDownloadUrl(d), {
    headers: d.headers
  });

  if (!response.ok) {
    throw new Error(`Cargo download failed with status ${response.status}`);
  }

  return response;
};
