import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody,
  mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery,
  type DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody,
  type DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery
} from '../resources';

/**
 * @name Provider Setup Sessions controller
 * @description A setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderDeploymentsSetupSessionsEmailsEndpoint {
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
   * @name Email provider setup session link
   * @description Queues the link of an admin setup session for delivery to up to 10 recipients in total, given as email addresses and/or organization member IDs. Recipients are deduplicated case-insensitively and processed in order; if a later recipient fails, earlier ones may already have been queued, and retrying the request within the same window does not email them again. A recipient already emailed this setup link in the current fixed 10-minute window is not emailed again; their earlier record is returned with `deduplicated` set to true. A setup link can be emailed to at most 50 different recipients within 24 hours, and the setup links of an instance to at most 200 different recipients combined; a request that would exceed either limit is rejected with `admin_setup_email_limit_reached` before any email is queued. Passing `organization_member_ids` also requires the `organization.member:read` scope, since the response contains the members' email addresses.
   *
   * @param `instanceId` - string
   * @param `providerSetupSessionId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    providerSetupSessionId: string,
    body: DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions/${providerSetupSessionId}/emails`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput
    );
  }

  /**
   * @name List provider setup session emails
   * @description Returns a paginated list of the emails queued for delivery with the link of a provider setup session. Emails addressed to organization members have `recipient_email` set to null unless the caller also has the `organization.member:read` scope.
   *
   * @param `instanceId` - string
   * @param `providerSetupSessionId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerSetupSessionId: string,
    query?: DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions/${providerSetupSessionId}/emails`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput
    );
  }
}
