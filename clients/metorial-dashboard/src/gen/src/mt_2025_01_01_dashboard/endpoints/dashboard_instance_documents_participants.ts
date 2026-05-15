import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsParticipantsGetOutput,
  mapDashboardInstanceDocumentsParticipantsListOutput,
  mapDashboardInstanceDocumentsParticipantsListQuery,
  type DashboardInstanceDocumentsParticipantsGetOutput,
  type DashboardInstanceDocumentsParticipantsListOutput,
  type DashboardInstanceDocumentsParticipantsListQuery
} from '../resources';

/**
 * @name Document Participants controller
 * @description Inspect document participants and their linked Metorial resources.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceDocumentsParticipantsEndpoint {
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
   * @name List document participants
   * @description Returns a paginated list of participants for a specific document.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `query` - DashboardInstanceDocumentsParticipantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsParticipantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    documentId: string,
    query?: DashboardInstanceDocumentsParticipantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsParticipantsListOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/participants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceDocumentsParticipantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsParticipantsListOutput
    );
  }

  /**
   * @name Get document participant by ID
   * @description Retrieves a specific document participant by its ID.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `documentParticipantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsParticipantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    documentId: string,
    documentParticipantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsParticipantsGetOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/participants/${documentParticipantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsParticipantsGetOutput
    );
  }
}
