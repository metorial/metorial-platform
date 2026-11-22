import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingIngestSourcesCreateBody,
  mapDashboardInstanceAgentTrackingIngestSourcesCreateOutput,
  mapDashboardInstanceAgentTrackingIngestSourcesGetOutput,
  mapDashboardInstanceAgentTrackingIngestSourcesListOutput,
  mapDashboardInstanceAgentTrackingIngestSourcesListQuery,
  mapDashboardInstanceAgentTrackingIngestSourcesRevokeOutput,
  type DashboardInstanceAgentTrackingIngestSourcesCreateBody,
  type DashboardInstanceAgentTrackingIngestSourcesCreateOutput,
  type DashboardInstanceAgentTrackingIngestSourcesGetOutput,
  type DashboardInstanceAgentTrackingIngestSourcesListOutput,
  type DashboardInstanceAgentTrackingIngestSourcesListQuery,
  type DashboardInstanceAgentTrackingIngestSourcesRevokeOutput
} from '../resources';

/**
 * @name Agent Tracking Ingestion Keys controller
 * @description Create, list and revoke the keys AI coding agents use to send their usage to agent tracking.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingIngestSourcesEndpoint {
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
   * @name List ingestion keys
   * @description Returns the ingestion keys of the instance. Defaults to active keys.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingIngestSourcesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingIngestSourcesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingIngestSourcesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingIngestSourcesListOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/ingest-sources`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingIngestSourcesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingIngestSourcesListOutput
    );
  }

  /**
   * @name Create ingestion key
   * @description Creates an ingestion key for the instance. The key is in the response once and cannot be read again.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAgentTrackingIngestSourcesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingIngestSourcesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceAgentTrackingIngestSourcesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingIngestSourcesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/ingest-sources`;

    let request = {
      path,
      body: mapDashboardInstanceAgentTrackingIngestSourcesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAgentTrackingIngestSourcesCreateOutput
    );
  }

  /**
   * @name Get ingestion key
   * @description Retrieves an ingestion key of the instance, without its secret.
   *
   * @param `instanceId` - string
   * @param `ingestSourceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingIngestSourcesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    ingestSourceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingIngestSourcesGetOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/ingest-sources/${ingestSourceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingIngestSourcesGetOutput
    );
  }

  /**
   * @name Revoke ingestion key
   * @description Revokes an ingestion key. Data sent with it is rejected once the revocation reaches agent tracking, usually within seconds. Revoking a revoked key changes nothing.
   *
   * @param `instanceId` - string
   * @param `ingestSourceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingIngestSourcesRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    instanceId: string,
    ingestSourceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingIngestSourcesRevokeOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/ingest-sources/${ingestSourceId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAgentTrackingIngestSourcesRevokeOutput
    );
  }
}
