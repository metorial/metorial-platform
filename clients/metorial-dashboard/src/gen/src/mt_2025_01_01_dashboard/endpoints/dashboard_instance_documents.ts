import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsCloneBody,
  mapDashboardInstanceDocumentsCloneOutput,
  mapDashboardInstanceDocumentsCreateBody,
  mapDashboardInstanceDocumentsCreateOutput,
  mapDashboardInstanceDocumentsDeleteOutput,
  mapDashboardInstanceDocumentsGetOutput,
  mapDashboardInstanceDocumentsListOutput,
  mapDashboardInstanceDocumentsListQuery,
  mapDashboardInstanceDocumentsUpdateBody,
  mapDashboardInstanceDocumentsUpdateOutput,
  type DashboardInstanceDocumentsCloneBody,
  type DashboardInstanceDocumentsCloneOutput,
  type DashboardInstanceDocumentsCreateBody,
  type DashboardInstanceDocumentsCreateOutput,
  type DashboardInstanceDocumentsDeleteOutput,
  type DashboardInstanceDocumentsGetOutput,
  type DashboardInstanceDocumentsListOutput,
  type DashboardInstanceDocumentsListQuery,
  type DashboardInstanceDocumentsUpdateBody,
  type DashboardInstanceDocumentsUpdateOutput
} from '../resources';

/**
 * @name Documents controller
 * @description Create and manage instance documents backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceDocumentsEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List documents
   * @description Returns a paginated list of documents owned by the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceDocumentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceDocumentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsListOutput> {
    let path = `dashboard/instances/${instanceId}/documents`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceDocumentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsListOutput
    );
  }

  /**
   * @name Create document
   * @description Creates a new document for the instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceDocumentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceDocumentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/documents`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceDocumentsCreateOutput
    );
  }

  /**
   * @name Get document by ID
   * @description Retrieves a document by its ID.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    documentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceDocumentsGetOutput);
  }

  /**
   * @name Update document by ID
   * @description Updates a specific document.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `body` - DashboardInstanceDocumentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    documentId: string,
    body: DashboardInstanceDocumentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceDocumentsUpdateOutput
    );
  }

  /**
   * @name Delete document by ID
   * @description Deletes a specific document.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    documentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceDocumentsDeleteOutput
    );
  }

  /**
   * @name Clone document by ID
   * @description Clones a specific document.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `body` - DashboardInstanceDocumentsCloneBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCloneOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  clone(
    instanceId: string,
    documentId: string,
    body: DashboardInstanceDocumentsCloneBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCloneOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/clone`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCloneBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceDocumentsCloneOutput
    );
  }
}
