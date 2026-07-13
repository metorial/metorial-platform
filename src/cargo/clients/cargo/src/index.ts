import { createClient } from '@lowerdeck/rpc-client';
import type { CargoClient } from '../../../service/src/controllers';

type RpcClientOpts = Parameters<typeof createClient>[0];
type CargoHeaders = Record<string, string> | Array<[string, string]> | Headers;

export type CargoHttpEndpoints = {
  uploadEndpoint: string;
  contentEndpoint: string;
  headers?: CargoHeaders;
};

export type CargoDocumentLiveEndpoints = {
  liveEndpoint: string;
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

export type CargoDocumentLiveInput = {
  documentId: string;
  actorId?: string;
  instanceId?: string;
  organizationId?: string;
};

export type CargoDocumentLiveClientMessage =
  | {
      type: 'ping';
    }
  | {
      type: 'document_update';
      data: {
        content: string;
        title?: string;
      };
    }
  | {
      type: 'document_title_update';
      data: {
        title: string;
      };
    };

export type CargoDocumentSnapshotFile = {
  object: 'cargo#file';
  id: string;
  type: 'document' | 'file';
  status: string;
  documentId: string | null;
  storeId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  title: string;
  purpose: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CargoDocumentSnapshot = {
  object: 'cargo#document';
  id: string;
  title: string;
  status: string;
  fileId: string;
  file: CargoDocumentSnapshotFile;
  parentDocumentId: string | null;
  currentVersionId: string | null;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CargoDocumentLiveServerMessage =
  | {
      type: 'document_snapshot';
      data: CargoDocumentSnapshot;
    }
  | {
      type: 'participant_list';
      data: Array<{
        object: 'cargo#documentParticipant';
        id: string;
        documentId: string;
        role: 'editor' | 'viewer';
        editCount: number;
        lastEditedAt: string | Date | null;
        lastViewedAt: string | Date | null;
        actor: {
          object: 'cargo#actor';
          id: string;
          identifier: string;
          type: string;
          name: string;
          organizationActorId?: string | null;
          consumerId?: string | null;
          createdAt: string | Date;
        };
        createdAt: string | Date;
      }>;
    }
  | {
      type: 'pong';
      data: {
        documentId: string;
      };
    }
  | {
      type: 'error';
      data: unknown;
    };

export let createCargoClient = (o: RpcClientOpts): CargoClient => createClient<CargoClient>(o);

export let getFileDownloadUrl = (d: {
  contentEndpoint: string;
  fileId: string;
  key: string;
  download?: boolean;
}) => {
  let url = `${d.contentEndpoint.replace(/\/$/, '')}/files/${d.fileId}/${d.key}`;
  if (d.download) url += '?download';

  return url;
};

export let getDocumentLiveUrl = (
  endpoints: CargoDocumentLiveEndpoints,
  input: CargoDocumentLiveInput
) => {
  let url = new URL(`${endpoints.liveEndpoint.replace(/\/$/, '')}/documents-live`);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';

  url.searchParams.set('documentId', input.documentId);
  if (input.actorId) url.searchParams.set('actorId', input.actorId);
  if (input.instanceId) url.searchParams.set('instanceId', input.instanceId);
  if (input.organizationId) url.searchParams.set('organizationId', input.organizationId);

  return url.toString();
};

export let createDocumentLiveConnection = (
  endpoints: CargoDocumentLiveEndpoints,
  input: CargoDocumentLiveInput
) => new WebSocket(getDocumentLiveUrl(endpoints, input));

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
    let text: string;
    try {
      text = await response.text();
    } catch {
      text = '';
    }

    throw new Error(`Cargo upload failed with status ${response.status} - ${text}`);
  }

  return (await response.json()) as CargoUploadResult;
};

export let downloadFile = async (d: {
  contentEndpoint: string;
  fileId: string;
  key: string;
  download?: boolean;
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
