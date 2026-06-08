import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAssistantsGetOutput,
  mapDashboardInstanceAssistantsListOutput,
  mapDashboardInstanceAssistantsListQuery,
  type DashboardInstanceAssistantsGetOutput,
  type DashboardInstanceAssistantsListOutput,
  type DashboardInstanceAssistantsListQuery
} from '../resources';

/**
 * @name Assistants controller
 * @description Assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAssistantsEndpoint {
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
   * @description List assistants available in an instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAssistantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAssistantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAssistantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAssistantsListOutput> {
    let path = `dashboard/instances/${instanceId}/assistants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAssistantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAssistantsListOutput
    );
  }

  /**
   * @name Get assistant
   * @description Get an assistant available in an instance.
   *
   * @param `instanceId` - string
   * @param `assistantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAssistantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    assistantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAssistantsGetOutput> {
    let path = `dashboard/instances/${instanceId}/assistants/${assistantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAssistantsGetOutput
    );
  }
}
