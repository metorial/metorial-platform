import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksDestinationsCreateBody,
  mapDashboardInstanceCallbacksDestinationsCreateOutput,
  mapDashboardInstanceCallbacksDestinationsDeleteOutput,
  mapDashboardInstanceCallbacksDestinationsGetOutput,
  mapDashboardInstanceCallbacksDestinationsListOutput,
  mapDashboardInstanceCallbacksDestinationsListQuery,
  mapDashboardInstanceCallbacksDestinationsUpdateBody,
  mapDashboardInstanceCallbacksDestinationsUpdateOutput,
  type DashboardInstanceCallbacksDestinationsCreateBody,
  type DashboardInstanceCallbacksDestinationsCreateOutput,
  type DashboardInstanceCallbacksDestinationsDeleteOutput,
  type DashboardInstanceCallbacksDestinationsGetOutput,
  type DashboardInstanceCallbacksDestinationsListOutput,
  type DashboardInstanceCallbacksDestinationsListQuery,
  type DashboardInstanceCallbacksDestinationsUpdateBody,
  type DashboardInstanceCallbacksDestinationsUpdateOutput
} from '../resources';

/**
 * @name Callback Destinations controller
 * @description Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbacksDestinationsEndpoint {
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
   * @name List callback destinations
   * @description Returns a paginated list of callback destinations for a specific callback.
   *
   * @param `query` - DashboardInstanceCallbacksDestinationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDestinationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCallbacksDestinationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDestinationsListOutput> {
    let path = 'callbacks-destinations';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksDestinationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksDestinationsListOutput
    );
  }

  /**
   * @name Get callback destination by ID
   * @description Retrieves details for a specific callback by its ID.
   *
   * @param `destinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDestinationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    destinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDestinationsGetOutput> {
    let path = `callbacks-destinations/${destinationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksDestinationsGetOutput
    );
  }

  /**
   * @name Create callback destination
   * @description Creates a new callback destination for the instance.
   *
   * @param `body` - DashboardInstanceCallbacksDestinationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDestinationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceCallbacksDestinationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDestinationsCreateOutput> {
    let path = 'callbacks-destinations';

    let request = {
      path,
      body: mapDashboardInstanceCallbacksDestinationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksDestinationsCreateOutput
    );
  }

  /**
   * @name Update callback destination
   * @description Updates an existing callback destination for the instance.
   *
   * @param `destinationId` - string
   * @param `body` - DashboardInstanceCallbacksDestinationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDestinationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    destinationId: string,
    body: DashboardInstanceCallbacksDestinationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDestinationsUpdateOutput> {
    let path = `callbacks-destinations/${destinationId}`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksDestinationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCallbacksDestinationsUpdateOutput
    );
  }

  /**
   * @name Delete callback destination
   * @description Deletes an existing callback destination for the instance.
   *
   * @param `destinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDestinationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    destinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDestinationsDeleteOutput> {
    let path = `callbacks-destinations/${destinationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceCallbacksDestinationsDeleteOutput
    );
  }
}
