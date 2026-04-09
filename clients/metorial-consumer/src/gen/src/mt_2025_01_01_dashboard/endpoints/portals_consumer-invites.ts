import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerInvitesCreateBody,
  mapDashboardInstancePortalsConsumerInvitesCreateOutput,
  mapDashboardInstancePortalsConsumerInvitesGetOutput,
  mapDashboardInstancePortalsConsumerInvitesListOutput,
  mapDashboardInstancePortalsConsumerInvitesListQuery,
  type DashboardInstancePortalsConsumerInvitesCreateBody,
  type DashboardInstancePortalsConsumerInvitesCreateOutput,
  type DashboardInstancePortalsConsumerInvitesGetOutput,
  type DashboardInstancePortalsConsumerInvitesListOutput,
  type DashboardInstancePortalsConsumerInvitesListQuery
} from '../resources';

/**
 * @name Portal Consumer Invites controller
 * @description List and inspect consumer invites for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPortalsConsumerInvitesEndpoint {
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
   * @name List portal consumer invites
   * @description Returns a paginated list of invites for a portal.
   *
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerInvitesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerInvitesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    portalId: string,
    query?: DashboardInstancePortalsConsumerInvitesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerInvitesListOutput> {
    let path = `portals/${portalId}/invites`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerInvitesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerInvitesListOutput
    );
  }

  /**
   * @name Create portal consumer invite
   * @description Invites a consumer to a portal.
   *
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerInvitesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerInvitesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    portalId: string,
    body: DashboardInstancePortalsConsumerInvitesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerInvitesCreateOutput> {
    let path = `portals/${portalId}/invites`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerInvitesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerInvitesCreateOutput
    );
  }

  /**
   * @name Get portal consumer invite
   * @description Retrieves a portal consumer invite by ID.
   *
   * @param `portalId` - string
   * @param `consumerInviteId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerInvitesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalId: string,
    consumerInviteId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerInvitesGetOutput> {
    let path = `portals/${portalId}/invites/${consumerInviteId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerInvitesGetOutput
    );
  }
}
