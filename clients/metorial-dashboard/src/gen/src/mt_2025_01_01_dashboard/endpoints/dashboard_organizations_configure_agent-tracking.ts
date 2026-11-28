import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsConfigureAgentTrackingGetOutput,
  mapDashboardOrganizationsConfigureAgentTrackingUpdateBody,
  mapDashboardOrganizationsConfigureAgentTrackingUpdateOutput,
  type DashboardOrganizationsConfigureAgentTrackingGetOutput,
  type DashboardOrganizationsConfigureAgentTrackingUpdateBody,
  type DashboardOrganizationsConfigureAgentTrackingUpdateOutput
} from '../resources';

/**
 * @name Agent Tracking Organization Settings controller
 * @description The privacy, Metorial Desktop and link settings of agent tracking, for the whole organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsConfigureAgentTrackingEndpoint {
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
   * @name Get agent tracking organization settings
   * @description Returns the privacy, Metorial Desktop and link settings of agent tracking for the organization.
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigureAgentTrackingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigureAgentTrackingGetOutput> {
    let path = `dashboard/organizations/${organizationId}/configure/agent-tracking`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConfigureAgentTrackingGetOutput
    );
  }

  /**
   * @name Update agent tracking organization settings
   * @description Changes the privacy, Metorial Desktop and link settings of the organization; leaving a field out keeps its value. Applies to the next request. service_status says whether agent tracking has taken the change yet.
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsConfigureAgentTrackingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigureAgentTrackingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    body: DashboardOrganizationsConfigureAgentTrackingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigureAgentTrackingUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/configure/agent-tracking`;

    let request = {
      path,
      body: mapDashboardOrganizationsConfigureAgentTrackingUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsConfigureAgentTrackingUpdateOutput
    );
  }
}
