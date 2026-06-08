import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsVersionsGetOutput,
  mapDashboardInstanceDocumentsVersionsListOutput,
  mapDashboardInstanceDocumentsVersionsListQuery,
  type DashboardInstanceDocumentsVersionsGetOutput,
  type DashboardInstanceDocumentsVersionsListOutput,
  type DashboardInstanceDocumentsVersionsListQuery
} from '../resources';

/**
 * @name Document Versions controller
 * @description Inspect document version history for an instance document.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceDocumentsVersionsEndpoint {
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
   * @name List document versions
   * @description Returns a paginated list of versions for a specific document.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `query` - DashboardInstanceDocumentsVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    documentId: string,
    query?: DashboardInstanceDocumentsVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsVersionsListOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceDocumentsVersionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsVersionsListOutput
    );
  }

  /**
   * @name Get document version by ID
   * @description Retrieves a specific document version by its ID.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `documentVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    documentId: string,
    documentVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsVersionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/versions/${documentVersionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsVersionsGetOutput
    );
  }
}
