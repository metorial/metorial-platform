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
 * @description A provider setup session is a guided flow that collects authentication, configuration, or both for a provider. `admin` sessions create a consent link for someone else to complete instead.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderDeploymentsSetupSessionsEmailsEndpoint {
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
   * @description Queues the link of an admin setup session for delivery to up to 10 recipients, given as email addresses and/or organization member IDs. A recipient already emailed this setup link in the current fixed 10-minute window isn't emailed again.
   *
   * @param `providerSetupSessionId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    providerSetupSessionId: string,
    body: DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput> {
    let path = `provider-setup-sessions/${providerSetupSessionId}/emails`;

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
   * @param `providerSetupSessionId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    providerSetupSessionId: string,
    query?: DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput> {
    let path = `provider-setup-sessions/${providerSetupSessionId}/emails`;

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
