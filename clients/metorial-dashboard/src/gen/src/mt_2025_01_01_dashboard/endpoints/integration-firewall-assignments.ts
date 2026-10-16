import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationFirewallAssignmentsCreateBody,
  mapDashboardInstanceIntegrationFirewallAssignmentsCreateOutput,
  mapDashboardInstanceIntegrationFirewallAssignmentsDeleteOutput,
  mapDashboardInstanceIntegrationFirewallAssignmentsGetOutput,
  mapDashboardInstanceIntegrationFirewallAssignmentsListOutput,
  mapDashboardInstanceIntegrationFirewallAssignmentsListQuery,
  type DashboardInstanceIntegrationFirewallAssignmentsCreateBody,
  type DashboardInstanceIntegrationFirewallAssignmentsCreateOutput,
  type DashboardInstanceIntegrationFirewallAssignmentsDeleteOutput,
  type DashboardInstanceIntegrationFirewallAssignmentsGetOutput,
  type DashboardInstanceIntegrationFirewallAssignmentsListOutput,
  type DashboardInstanceIntegrationFirewallAssignmentsListQuery
} from '../resources';

/**
 * @name Integration Firewall Assignments controller
 * @description Manage assignments that apply firewalls to integration enclaves, providers, or the integration internet gateway.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIntegrationFirewallAssignmentsEndpoint {
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
   * @name List integration firewall assignments
   * @description Returns a paginated list of integration firewall assignments.
   *
   * @param `query` - DashboardInstanceIntegrationFirewallAssignmentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationFirewallAssignmentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIntegrationFirewallAssignmentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationFirewallAssignmentsListOutput> {
    let path = 'integration-firewall-assignments';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationFirewallAssignmentsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationFirewallAssignmentsListOutput
    );
  }

  /**
   * @name Get integration firewall assignment
   * @description Retrieves a specific integration firewall assignment by ID.
   *
   * @param `integrationFirewallAssignmentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationFirewallAssignmentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    integrationFirewallAssignmentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationFirewallAssignmentsGetOutput> {
    let path = `integration-firewall-assignments/${integrationFirewallAssignmentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationFirewallAssignmentsGetOutput
    );
  }

  /**
   * @name Create integration firewall assignment
   * @description Creates an assignment that applies a firewall to a target.
   *
   * @param `body` - DashboardInstanceIntegrationFirewallAssignmentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationFirewallAssignmentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIntegrationFirewallAssignmentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationFirewallAssignmentsCreateOutput> {
    let path = 'integration-firewall-assignments';

    let request = {
      path,
      body: mapDashboardInstanceIntegrationFirewallAssignmentsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationFirewallAssignmentsCreateOutput
    );
  }

  /**
   * @name Delete integration firewall assignment
   * @description Deletes an integration firewall assignment.
   *
   * @param `integrationFirewallAssignmentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationFirewallAssignmentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    integrationFirewallAssignmentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationFirewallAssignmentsDeleteOutput> {
    let path = `integration-firewall-assignments/${integrationFirewallAssignmentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationFirewallAssignmentsDeleteOutput
    );
  }
}
