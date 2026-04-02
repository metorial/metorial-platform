import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumersProfilesGetOutput,
  mapDashboardInstanceConsumersProfilesListOutput,
  mapDashboardInstanceConsumersProfilesListQuery,
  type DashboardInstanceConsumersProfilesGetOutput,
  type DashboardInstanceConsumersProfilesListOutput,
  type DashboardInstanceConsumersProfilesListQuery
} from '../resources';

/**
 * @name Consumers controller
 * @description Manage instance consumers independently from portals and inspect the profiles linked to each consumer.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceConsumersProfilesEndpoint {
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
   * @name List consumer profiles
   * @description Returns a paginated list of profiles for a consumer in an instance.
   *
   * @param `instanceId` - string
   * @param `consumerId` - string
   * @param `query` - DashboardInstanceConsumersProfilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersProfilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    consumerId: string,
    query?: DashboardInstanceConsumersProfilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersProfilesListOutput> {
    let path = `instances/${instanceId}/consumers/${consumerId}/profiles`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConsumersProfilesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumersProfilesListOutput
    );
  }

  /**
   * @name Get consumer profile
   * @description Retrieves a consumer profile by ID for a consumer.
   *
   * @param `instanceId` - string
   * @param `consumerId` - string
   * @param `consumerProfileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersProfilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    consumerId: string,
    consumerProfileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersProfilesGetOutput> {
    let path = `instances/${instanceId}/consumers/${consumerId}/profiles/${consumerProfileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumersProfilesGetOutput
    );
  }
}
