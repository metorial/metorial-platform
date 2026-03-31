import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumersCreateBody,
  mapDashboardInstanceConsumersCreateOutput,
  mapDashboardInstanceConsumersGetOutput,
  mapDashboardInstanceConsumersListOutput,
  mapDashboardInstanceConsumersListQuery,
  mapDashboardInstanceConsumersUpdateBody,
  mapDashboardInstanceConsumersUpdateOutput,
  type DashboardInstanceConsumersCreateBody,
  type DashboardInstanceConsumersCreateOutput,
  type DashboardInstanceConsumersGetOutput,
  type DashboardInstanceConsumersListOutput,
  type DashboardInstanceConsumersListQuery,
  type DashboardInstanceConsumersUpdateBody,
  type DashboardInstanceConsumersUpdateOutput
} from '../resources';

/**
 * @name Consumers controller
 * @description Manage instance consumers independently from portals and inspect the profiles linked to each consumer.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceConsumersEndpoint {
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
   * @name List consumers
   * @description Returns a paginated list of consumers for an instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceConsumersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceConsumersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersListOutput> {
    let path = `dashboard/instances/${instanceId}/consumers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConsumersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumersListOutput
    );
  }

  /**
   * @name Get consumer
   * @description Retrieves a consumer by ID.
   *
   * @param `instanceId` - string
   * @param `consumerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    consumerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersGetOutput> {
    let path = `dashboard/instances/${instanceId}/consumers/${consumerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceConsumersGetOutput);
  }

  /**
   * @name Create consumer
   * @description Creates or links a consumer for an instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceConsumersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceConsumersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/consumers`;

    let request = {
      path,
      body: mapDashboardInstanceConsumersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceConsumersCreateOutput
    );
  }

  /**
   * @name Update consumer
   * @description Updates a consumer for an instance.
   *
   * @param `instanceId` - string
   * @param `consumerId` - string
   * @param `body` - DashboardInstanceConsumersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    consumerId: string,
    body: DashboardInstanceConsumersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/consumers/${consumerId}`;

    let request = {
      path,
      body: mapDashboardInstanceConsumersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceConsumersUpdateOutput
    );
  }
}
