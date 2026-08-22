import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput,
  mapDashboardInstanceCallbacksInstancesGetOutput,
  mapDashboardInstanceCallbacksInstancesListOutput,
  mapDashboardInstanceCallbacksInstancesListQuery,
  mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput,
  mapDashboardInstanceCallbacksInstancesSendTestEventBody,
  mapDashboardInstanceCallbacksInstancesSendTestEventOutput,
  type DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput,
  type DashboardInstanceCallbacksInstancesGetOutput,
  type DashboardInstanceCallbacksInstancesListOutput,
  type DashboardInstanceCallbacksInstancesListQuery,
  type DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput,
  type DashboardInstanceCallbacksInstancesSendTestEventBody,
  type DashboardInstanceCallbacksInstancesSendTestEventOutput
} from '../resources';

/**
 * @name Callback Instances controller
 * @description Inspect callback instances derived from configured integration providers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbacksInstancesEndpoint {
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
   * @name List callback instances
   * @description Returns a paginated list of callback instances.
   *
   * @param `callbackId` - string
   * @param `query` - DashboardInstanceCallbacksInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    callbackId: string,
    query?: DashboardInstanceCallbacksInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesListOutput> {
    let path = `callbacks/${callbackId}/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksInstancesListOutput
    );
  }

  /**
   * @name Get callback instance
   * @description Retrieves a specific callback instance by ID.
   *
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesGetOutput> {
    let path = `callbacks/${callbackId}/instances/${callbackInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksInstancesGetOutput
    );
  }

  /**
   * @name Send callback test event
   * @description Queues an authenticated dashboard synthetic event for a callback instance.
   *
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `body` - DashboardInstanceCallbacksInstancesSendTestEventBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesSendTestEventOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  sendTestEvent(
    callbackId: string,
    callbackInstanceId: string,
    body: DashboardInstanceCallbacksInstancesSendTestEventBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSendTestEventOutput> {
    let path = `callbacks/${callbackId}/instances/${callbackInstanceId}/test-event`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksInstancesSendTestEventBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesSendTestEventOutput
    );
  }

  /**
   * @name Create secure callback URL
   * @description Creates the initial receiver path secret and returns its plaintext once.
   *
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createReceiverPathSecret(
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput> {
    let path = `callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput
    );
  }

  /**
   * @name Rotate secure callback URL
   * @description Immediately rotates the receiver path secret and returns its new plaintext once.
   *
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotateReceiverPathSecret(
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput> {
    let path = `callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret/rotate`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput
    );
  }
}
