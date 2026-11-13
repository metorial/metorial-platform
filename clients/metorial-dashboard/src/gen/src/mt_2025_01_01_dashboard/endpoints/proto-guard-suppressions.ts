import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProtoGuardSuppressionsArchiveOutput,
  mapDashboardInstanceProtoGuardSuppressionsCreateBody,
  mapDashboardInstanceProtoGuardSuppressionsCreateOutput,
  mapDashboardInstanceProtoGuardSuppressionsGetOutput,
  mapDashboardInstanceProtoGuardSuppressionsListOutput,
  mapDashboardInstanceProtoGuardSuppressionsListQuery,
  type DashboardInstanceProtoGuardSuppressionsArchiveOutput,
  type DashboardInstanceProtoGuardSuppressionsCreateBody,
  type DashboardInstanceProtoGuardSuppressionsCreateOutput,
  type DashboardInstanceProtoGuardSuppressionsGetOutput,
  type DashboardInstanceProtoGuardSuppressionsListOutput,
  type DashboardInstanceProtoGuardSuppressionsListQuery
} from '../resources';

/**
 * @name ProtoGuard Suppression controller
 * @description ProtoGuard suppressions mark known-benign findings so they no longer raise alerts.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProtoGuardSuppressionsEndpoint {
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
   * @name List ProtoGuard suppressions
   * @description Returns the ProtoGuard suppressions of this instance.
   *
   * @param `query` - DashboardInstanceProtoGuardSuppressionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardSuppressionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProtoGuardSuppressionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardSuppressionsListOutput> {
    let path = 'protoguard-suppressions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProtoGuardSuppressionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProtoGuardSuppressionsListOutput
    );
  }

  /**
   * @name Get ProtoGuard suppression
   * @description Retrieves a ProtoGuard suppression.
   *
   * @param `suppressionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardSuppressionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    suppressionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardSuppressionsGetOutput> {
    let path = `protoguard-suppressions/${suppressionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProtoGuardSuppressionsGetOutput
    );
  }

  /**
   * @name Create ProtoGuard suppression
   * @description Suppresses future findings of a filter, optionally narrowed to a provider, tool, or specific matched content.
   *
   * @param `body` - DashboardInstanceProtoGuardSuppressionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardSuppressionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProtoGuardSuppressionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardSuppressionsCreateOutput> {
    let path = 'protoguard-suppressions';

    let request = {
      path,
      body: mapDashboardInstanceProtoGuardSuppressionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProtoGuardSuppressionsCreateOutput
    );
  }

  /**
   * @name Archive ProtoGuard suppression
   * @description Archives a ProtoGuard suppression so matching findings alert again.
   *
   * @param `suppressionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardSuppressionsArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    suppressionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardSuppressionsArchiveOutput> {
    let path = `protoguard-suppressions/${suppressionId}/archive`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProtoGuardSuppressionsArchiveOutput
    );
  }
}
