import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceStoresParticipantsGetOutput,
  mapDashboardInstanceStoresParticipantsListOutput,
  mapDashboardInstanceStoresParticipantsListQuery,
  type DashboardInstanceStoresParticipantsGetOutput,
  type DashboardInstanceStoresParticipantsListOutput,
  type DashboardInstanceStoresParticipantsListQuery
} from '../resources';

/**
 * @name Store Participants controller
 * @description Inspect participants assigned to an instance store.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialStoresParticipantsEndpoint {
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
   * @name List store participants
   * @description Returns a paginated list of participants for a specific store.
   *
   * @param `storeId` - string
   * @param `query` - DashboardInstanceStoresParticipantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresParticipantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    storeId: string,
    query?: DashboardInstanceStoresParticipantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresParticipantsListOutput> {
    let path = `stores/${storeId}/participants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceStoresParticipantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceStoresParticipantsListOutput
    );
  }

  /**
   * @name Get store participant by ID
   * @description Retrieves a specific participant within a store.
   *
   * @param `storeId` - string
   * @param `storeParticipantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresParticipantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    storeId: string,
    storeParticipantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresParticipantsGetOutput> {
    let path = `stores/${storeId}/participants/${storeParticipantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceStoresParticipantsGetOutput
    );
  }
}
