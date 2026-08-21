import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksInstancesCreateBody,
  mapDashboardInstanceCallbacksInstancesCreateOutput,
  mapDashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput,
  mapDashboardInstanceCallbacksInstancesDeleteOutput,
  mapDashboardInstanceCallbacksInstancesGetOutput,
  mapDashboardInstanceCallbacksInstancesListOutput,
  mapDashboardInstanceCallbacksInstancesListQuery,
  mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput,
  mapDashboardInstanceCallbacksInstancesSendTestEventBody,
  mapDashboardInstanceCallbacksInstancesSendTestEventOutput,
  type DashboardInstanceCallbacksInstancesCreateBody,
  type DashboardInstanceCallbacksInstancesCreateOutput,
  type DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput,
  type DashboardInstanceCallbacksInstancesDeleteOutput,
  type DashboardInstanceCallbacksInstancesGetOutput,
  type DashboardInstanceCallbacksInstancesListOutput,
  type DashboardInstanceCallbacksInstancesListQuery,
  type DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput,
  type DashboardInstanceCallbacksInstancesSendTestEventBody,
  type DashboardInstanceCallbacksInstancesSendTestEventOutput
} from '../resources';

/**
 * @name Callback Instances controller
 * @description Attach or detach callback instances for a deployment/config/auth-config combination.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCallbacksInstancesEndpoint {
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
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `query` - DashboardInstanceCallbacksInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    callbackId: string,
    query?: DashboardInstanceCallbacksInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesListOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances`;

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
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesGetOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksInstancesGetOutput
    );
  }

  /**
   * @name Create callback instance
   * @description Attaches a callback to a config and optional auth config.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `body` - DashboardInstanceCallbacksInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    callbackId: string,
    body: DashboardInstanceCallbacksInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksInstancesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesCreateOutput
    );
  }

  /**
   * @name Send callback test event
   * @description Queues an authenticated dashboard synthetic event for a callback instance.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `body` - DashboardInstanceCallbacksInstancesSendTestEventBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesSendTestEventOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  sendTestEvent(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    body: DashboardInstanceCallbacksInstancesSendTestEventBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSendTestEventOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/test-event`;

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
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createReceiverPathSecret(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesCreateReceiverPathSecretOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret`;

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
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotateReceiverPathSecret(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret/rotate`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput
    );
  }

  /**
   * @name Delete callback instance
   * @description Detaches a callback instance.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceCallbacksInstancesDeleteOutput
    );
  }
}
