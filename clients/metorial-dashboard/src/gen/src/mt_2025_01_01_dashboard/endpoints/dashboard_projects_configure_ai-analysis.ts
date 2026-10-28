import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureAiAnalysisGetOutput,
  mapDashboardProjectsConfigureAiAnalysisUpdateBody,
  mapDashboardProjectsConfigureAiAnalysisUpdateOutput,
  type DashboardProjectsConfigureAiAnalysisGetOutput,
  type DashboardProjectsConfigureAiAnalysisUpdateBody,
  type DashboardProjectsConfigureAiAnalysisUpdateOutput
} from '../resources';

/**
 * @name AI analysis configuration controller
 * @description Configure whether Metorial may analyze a project's custom providers with AI
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureAiAnalysisEndpoint {
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
   * @name Get project AI analysis configuration
   * @description Get the AI-based analysis setting for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAiAnalysisGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAiAnalysisGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/ai-analysis`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureAiAnalysisGetOutput
    );
  }

  /**
   * @name Update project AI analysis configuration
   * @description Enable or disable AI-based analysis for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureAiAnalysisUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAiAnalysisUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureAiAnalysisUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAiAnalysisUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/ai-analysis`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureAiAnalysisUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureAiAnalysisUpdateOutput
    );
  }
}
