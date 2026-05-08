import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAssistantsGetOutput,
  mapDashboardOrganizationsAssistantsListOutput,
  mapDashboardOrganizationsAssistantsListQuery,
  type DashboardOrganizationsAssistantsGetOutput,
  type DashboardOrganizationsAssistantsListOutput,
  type DashboardOrganizationsAssistantsListQuery
} from '../resources';

/**
 * @name Assistants controller
 * @description Dashboard-only assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationAssistantsEndpoint {
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
   * @name List assistants
   * @description List assistants available to an organization.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardOrganizationsAssistantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAssistantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardOrganizationsAssistantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAssistantsListOutput> {
    let path = `organization/instances/${instanceId}/assistants`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAssistantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAssistantsListOutput
    );
  }

  /**
   * @name Get assistant
   * @description Get an assistant available to an organization.
   *
   * @param `instanceId` - string
   * @param `assistantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAssistantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    assistantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAssistantsGetOutput> {
    let path = `organization/instances/${instanceId}/assistants/${assistantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAssistantsGetOutput
    );
  }
}
