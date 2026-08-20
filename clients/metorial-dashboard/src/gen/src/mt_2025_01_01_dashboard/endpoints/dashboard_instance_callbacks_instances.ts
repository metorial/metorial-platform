import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksInstancesCreateBody,
  mapDashboardInstanceCallbacksInstancesCreateOutput,
  mapDashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody,
  mapDashboardInstanceCallbacksInstancesDeleteOutput,
  mapDashboardInstanceCallbacksInstancesGetOutput,
  mapDashboardInstanceCallbacksInstancesGithubManifestSetupOutput,
  mapDashboardInstanceCallbacksInstancesListOutput,
  mapDashboardInstanceCallbacksInstancesListQuery,
  mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretBody,
  mapDashboardInstanceCallbacksInstancesSecretBulkRevocationOutput,
  mapDashboardInstanceCallbacksInstancesSecretConsumptionOutput,
  mapDashboardInstanceCallbacksInstancesSecretMutationOutput,
  mapDashboardInstanceCallbacksEventsGetOutput,
  type DashboardInstanceCallbacksEventsGetOutput,
  type DashboardInstanceCallbacksInstancesCreateBody,
  type DashboardInstanceCallbacksInstancesCreateOutput,
  type DashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody,
  type DashboardInstanceCallbacksInstancesDeleteOutput,
  type DashboardInstanceCallbacksInstancesGetOutput,
  type DashboardInstanceCallbacksInstancesGithubManifestSetupOutput,
  type DashboardInstanceCallbacksInstancesListOutput,
  type DashboardInstanceCallbacksInstancesListQuery,
  type DashboardInstanceCallbacksInstancesRotateReceiverPathSecretBody,
  type DashboardInstanceCallbacksInstancesSecretBulkRevocationOutput,
  type DashboardInstanceCallbacksInstancesSecretConsumptionOutput,
  type DashboardInstanceCallbacksInstancesSecretMutationOutput
} from '../resources';

export type DashboardInstanceCallbacksInstancesSendTestEventBody = {
  eventType: string;
  payload: Record<string, unknown>;
};

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

    return this._get(request).transform(mapDashboardInstanceCallbacksInstancesListOutput);
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

    return this._get(request).transform(mapDashboardInstanceCallbacksInstancesGetOutput);
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

    return this._post(request).transform(mapDashboardInstanceCallbacksInstancesCreateOutput);
  }

  /**
   * Queues an authenticated synthetic event for a callback instance.
   */
  sendTestEvent(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    body: DashboardInstanceCallbacksInstancesSendTestEventBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksEventsGetOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/test-event`;

    let request = {
      path,
      body: {
        event_type: body.eventType,
        payload: body.payload
      },
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceCallbacksEventsGetOutput);
  }

  createReceiverPathSecret(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSecretMutationOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret`,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesSecretMutationOutput
    );
  }

  rotateReceiverPathSecret(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    body: DashboardInstanceCallbacksInstancesRotateReceiverPathSecretBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSecretMutationOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret/rotate`,
      body: mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretBody.transformTo(
        body
      ),
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesSecretMutationOutput
    );
  }

  revokeReceiverPathSecret(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    secretId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSecretMutationOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret/${secretId}`,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._delete(request).transform(
      mapDashboardInstanceCallbacksInstancesSecretMutationOutput
    );
  }

  revokeAllReceiverPathSecrets(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSecretBulkRevocationOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret`,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._delete(request).transform(
      mapDashboardInstanceCallbacksInstancesSecretBulkRevocationOutput
    );
  }

  consumeReceiverPathSecretReceipt(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    receiptId: string,
    body: DashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesSecretConsumptionOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/path-secret/receipts/${receiptId}/consume`,
      body: mapDashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody.transformTo(
        body
      ),
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesSecretConsumptionOutput
    );
  }

  beginGithubManifest(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    provisionedTenantAppId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesGithubManifestSetupOutput> {
    let request = {
      path: `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}/security/provisioned-apps/${provisionedTenantAppId}/github-manifest`,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;
    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesGithubManifestSetupOutput
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

    return this._delete(request).transform(mapDashboardInstanceCallbacksInstancesDeleteOutput);
  }
}
