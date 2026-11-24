import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiToolDetectionsListOutput,
  mapDashboardInstanceAiToolDetectionsListQuery,
  type DashboardInstanceAiToolDetectionsListOutput,
  type DashboardInstanceAiToolDetectionsListQuery
} from '../resources';

/**
 * @name AI Tool Detections controller
 * @description An AI tool detection records that Metorial Desktop found an AI tool on an enrolled device. It is updated by every report the device sends and marked gone once a report leaves the tool out.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceAiToolDetectionsEndpoint {
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
   * @name List AI tool detections
   * @description Returns a paginated list of AI tool detections on signed-in devices. By default only tools the devices still report are returned.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiToolDetectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiToolDetectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiToolDetectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiToolDetectionsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-tool-detections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiToolDetectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAiToolDetectionsListOutput);
  }
}
