import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAuditLogStreamsCreateBody,
  mapDashboardOrganizationsAuditLogStreamsCreateOutput,
  mapDashboardOrganizationsAuditLogStreamsDeleteOutput,
  mapDashboardOrganizationsAuditLogStreamsGetOutput,
  mapDashboardOrganizationsAuditLogStreamsListOutput,
  mapDashboardOrganizationsAuditLogStreamsListQuery,
  mapDashboardOrganizationsAuditLogStreamsResumeOutput,
  mapDashboardOrganizationsAuditLogStreamsUpdateBody,
  mapDashboardOrganizationsAuditLogStreamsUpdateOutput,
  type DashboardOrganizationsAuditLogStreamsCreateBody,
  type DashboardOrganizationsAuditLogStreamsCreateOutput,
  type DashboardOrganizationsAuditLogStreamsDeleteOutput,
  type DashboardOrganizationsAuditLogStreamsGetOutput,
  type DashboardOrganizationsAuditLogStreamsListOutput,
  type DashboardOrganizationsAuditLogStreamsListQuery,
  type DashboardOrganizationsAuditLogStreamsResumeOutput,
  type DashboardOrganizationsAuditLogStreamsUpdateBody,
  type DashboardOrganizationsAuditLogStreamsUpdateOutput
} from '../resources';

/**
 * @name Audit log stream controller
 * @description Manage organization audit log streams
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationAuditLogStreamsEndpoint {
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
   * @name List organization audit log streams
   * @description List all audit log streams configured for the organization
   *
   * @param `query` - DashboardOrganizationsAuditLogStreamsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsAuditLogStreamsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsListOutput> {
    let path = 'organization/audit-log-streams';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAuditLogStreamsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogStreamsListOutput
    );
  }

  /**
   * @name Get organization audit log stream
   * @description Get a specific audit log stream configured for the organization
   *
   * @param `auditLogStreamId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    auditLogStreamId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsGetOutput> {
    let path = `organization/audit-log-streams/${auditLogStreamId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogStreamsGetOutput
    );
  }

  /**
   * @name Create organization audit log stream
   * @description Create an audit log stream for the organization
   *
   * @param `body` - DashboardOrganizationsAuditLogStreamsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsAuditLogStreamsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsCreateOutput> {
    let path = 'organization/audit-log-streams';

    let request = {
      path,
      body: mapDashboardOrganizationsAuditLogStreamsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsAuditLogStreamsCreateOutput
    );
  }

  /**
   * @name Update organization audit log stream
   * @description Update an audit log stream configured for the organization
   *
   * @param `auditLogStreamId` - string
   * @param `body` - DashboardOrganizationsAuditLogStreamsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    auditLogStreamId: string,
    body: DashboardOrganizationsAuditLogStreamsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsUpdateOutput> {
    let path = `organization/audit-log-streams/${auditLogStreamId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsAuditLogStreamsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsAuditLogStreamsUpdateOutput
    );
  }

  /**
   * @name Resume organization audit log stream
   * @description Resume an audit log stream paused after repeated delivery errors
   *
   * @param `auditLogStreamId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsResumeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  resume(
    auditLogStreamId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsResumeOutput> {
    let path = `organization/audit-log-streams/${auditLogStreamId}/resume`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsAuditLogStreamsResumeOutput
    );
  }

  /**
   * @name Delete organization audit log stream
   * @description Delete an audit log stream configured for the organization
   *
   * @param `auditLogStreamId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    auditLogStreamId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsDeleteOutput> {
    let path = `organization/audit-log-streams/${auditLogStreamId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsAuditLogStreamsDeleteOutput
    );
  }
}
