import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAuthAppGetOutput,
  mapDashboardInstancePortalsAuthAppUpdateBody,
  mapDashboardInstancePortalsAuthAppUpdateOutput,
  type DashboardInstancePortalsAuthAppGetOutput,
  type DashboardInstancePortalsAuthAppUpdateBody,
  type DashboardInstancePortalsAuthAppUpdateOutput
} from '../resources';

/**
 * @name Portal Auth controller
 * @description Manage the Ares-backed authentication configuration for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsAuthAppEndpoint {
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
   * @name Get portal auth app
   * @description Returns the Ares app configuration for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthAppGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthAppGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth/app`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAuthAppGetOutput
    );
  }

  /**
   * @name Update portal auth app
   * @description Updates the portal auth app configuration stored on the portal surface.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsAuthAppUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthAppUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsAuthAppUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthAppUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth/app`;

    let request = {
      path,
      body: mapDashboardInstancePortalsAuthAppUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsAuthAppUpdateOutput
    );
  }
}
