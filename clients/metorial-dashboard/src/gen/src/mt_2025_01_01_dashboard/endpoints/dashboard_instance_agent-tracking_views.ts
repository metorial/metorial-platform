import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingViewsCreateBody,
  mapDashboardInstanceAgentTrackingViewsCreateOutput,
  mapDashboardInstanceAgentTrackingViewsDeleteOutput,
  mapDashboardInstanceAgentTrackingViewsGetOutput,
  mapDashboardInstanceAgentTrackingViewsListOutput,
  mapDashboardInstanceAgentTrackingViewsListQuery,
  mapDashboardInstanceAgentTrackingViewsUpdateBody,
  mapDashboardInstanceAgentTrackingViewsUpdateOutput,
  type DashboardInstanceAgentTrackingViewsCreateBody,
  type DashboardInstanceAgentTrackingViewsCreateOutput,
  type DashboardInstanceAgentTrackingViewsDeleteOutput,
  type DashboardInstanceAgentTrackingViewsGetOutput,
  type DashboardInstanceAgentTrackingViewsListOutput,
  type DashboardInstanceAgentTrackingViewsListQuery,
  type DashboardInstanceAgentTrackingViewsUpdateBody,
  type DashboardInstanceAgentTrackingViewsUpdateOutput
} from '../resources';

/**
 * @name Agent Tracking Saved Views controller
 * @description A saved view is a named set of agent usage page settings, such as range, sort and flag thresholds, shared with everyone who can read agent usage in the instance. It never contains members.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingViewsEndpoint {
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
   * @name List saved views
   * @description Returns a paginated list of the saved views of the instance, oldest first. Available while individuals are hidden, since views contain no member data.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingViewsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingViewsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingViewsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingViewsListOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/views`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingViewsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentTrackingViewsListOutput);
  }

  /**
   * @name Create saved view
   * @description Creates a saved view. An instance can have at most 50 saved views per page.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAgentTrackingViewsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingViewsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceAgentTrackingViewsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingViewsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/views`;

    let request = {
      path,
      body: mapDashboardInstanceAgentTrackingViewsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceAgentTrackingViewsCreateOutput);
  }

  /**
   * @name Get saved view
   * @description Retrieves a saved view.
   *
   * @param `instanceId` - string
   * @param `viewId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingViewsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    viewId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingViewsGetOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/views/${viewId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentTrackingViewsGetOutput);
  }

  /**
   * @name Update saved view
   * @description Updates a saved view. Omitted fields keep their current value; `params` replaces the stored settings as a whole.
   *
   * @param `instanceId` - string
   * @param `viewId` - string
   * @param `body` - DashboardInstanceAgentTrackingViewsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingViewsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    viewId: string,
    body: DashboardInstanceAgentTrackingViewsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingViewsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/views/${viewId}`;

    let request = {
      path,
      body: mapDashboardInstanceAgentTrackingViewsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceAgentTrackingViewsUpdateOutput);
  }

  /**
   * @name Delete saved view
   * @description Deletes a saved view. It no longer appears in lists and its name can be used again. Deleted views cannot be restored.
   *
   * @param `instanceId` - string
   * @param `viewId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingViewsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    viewId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingViewsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/views/${viewId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardInstanceAgentTrackingViewsDeleteOutput);
  }
}
