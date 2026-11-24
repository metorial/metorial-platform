import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayVirtualModelsCreateBody,
  mapDashboardInstanceAiGatewayVirtualModelsCreateFromTemplateBody,
  mapDashboardInstanceAiGatewayVirtualModelsCreateFromTemplateOutput,
  mapDashboardInstanceAiGatewayVirtualModelsCreateOutput,
  mapDashboardInstanceAiGatewayVirtualModelsDeleteOutput,
  mapDashboardInstanceAiGatewayVirtualModelsGetOutput,
  mapDashboardInstanceAiGatewayVirtualModelsListOutput,
  mapDashboardInstanceAiGatewayVirtualModelsListQuery,
  mapDashboardInstanceAiGatewayVirtualModelsReplayBody,
  mapDashboardInstanceAiGatewayVirtualModelsReplayOutput,
  mapDashboardInstanceAiGatewayVirtualModelsRollbackBody,
  mapDashboardInstanceAiGatewayVirtualModelsRollbackOutput,
  mapDashboardInstanceAiGatewayVirtualModelsTestBody,
  mapDashboardInstanceAiGatewayVirtualModelsTestDraftBody,
  mapDashboardInstanceAiGatewayVirtualModelsTestDraftOutput,
  mapDashboardInstanceAiGatewayVirtualModelsTestOutput,
  mapDashboardInstanceAiGatewayVirtualModelsUpdateBody,
  mapDashboardInstanceAiGatewayVirtualModelsUpdateOutput,
  type DashboardInstanceAiGatewayVirtualModelsCreateBody,
  type DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateBody,
  type DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateOutput,
  type DashboardInstanceAiGatewayVirtualModelsCreateOutput,
  type DashboardInstanceAiGatewayVirtualModelsDeleteOutput,
  type DashboardInstanceAiGatewayVirtualModelsGetOutput,
  type DashboardInstanceAiGatewayVirtualModelsListOutput,
  type DashboardInstanceAiGatewayVirtualModelsListQuery,
  type DashboardInstanceAiGatewayVirtualModelsReplayBody,
  type DashboardInstanceAiGatewayVirtualModelsReplayOutput,
  type DashboardInstanceAiGatewayVirtualModelsRollbackBody,
  type DashboardInstanceAiGatewayVirtualModelsRollbackOutput,
  type DashboardInstanceAiGatewayVirtualModelsTestBody,
  type DashboardInstanceAiGatewayVirtualModelsTestDraftBody,
  type DashboardInstanceAiGatewayVirtualModelsTestDraftOutput,
  type DashboardInstanceAiGatewayVirtualModelsTestOutput,
  type DashboardInstanceAiGatewayVirtualModelsUpdateBody,
  type DashboardInstanceAiGatewayVirtualModelsUpdateOutput
} from '../resources';

/**
 * @name AI gateway virtual models controller
 * @description Virtual models are model names that pick a real model for every request, using rules, optional signals answered by a decision model, a default, and stickiness. Every change to the definition creates a new version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayVirtualModelsEndpoint {
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
   * @name List AI gateway virtual models
   * @description Returns a paginated list of virtual models.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayVirtualModelsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayVirtualModelsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayVirtualModelsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsListOutput
    );
  }

  /**
   * @name Get AI gateway virtual model
   * @description Retrieves a virtual model by ID or slug, with its current definition.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    virtualModelId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsGetOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsGetOutput
    );
  }

  /**
   * @name Create AI gateway virtual model
   * @description Creates a virtual model with its first version. Requests that use its slug as the model are routed by the definition.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceAiGatewayVirtualModelsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsCreateOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsCreateOutput
    );
  }

  /**
   * @name Create AI gateway virtual model from template
   * @description Creates a virtual model from a template, filling in the models it asks for. The definition can be changed afterwards like any other.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createFromTemplate(
    instanceId: string,
    body: DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsCreateFromTemplateOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/from-template`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsCreateFromTemplateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsCreateFromTemplateOutput
    );
  }

  /**
   * @name Test AI gateway virtual model draft
   * @description Routes a request through an unsaved definition and shows which rule and models it picks. Nothing is sent to a provider, but the decision model is called and billed when a rule reads signals.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsTestDraftBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsTestDraftOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  testDraft(
    instanceId: string,
    body: DashboardInstanceAiGatewayVirtualModelsTestDraftBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsTestDraftOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/test`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsTestDraftBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsTestDraftOutput
    );
  }

  /**
   * @name Update AI gateway virtual model
   * @description Updates the name, description or definition of a virtual model. A new definition becomes a new version and takes effect right away.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    virtualModelId: string,
    body: DashboardInstanceAiGatewayVirtualModelsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsUpdateOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsUpdateOutput
    );
  }

  /**
   * @name Delete AI gateway virtual model
   * @description Deletes a virtual model. Requests that use its slug are no longer routed by it, and the slug can be used again.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    virtualModelId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsDeleteOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsDeleteOutput
    );
  }

  /**
   * @name Roll back AI gateway virtual model
   * @description Makes an earlier version's definition current again, as a new version. The version history is kept.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsRollbackBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsRollbackOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rollback(
    instanceId: string,
    virtualModelId: string,
    body: DashboardInstanceAiGatewayVirtualModelsRollbackBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsRollbackOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/rollback`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsRollbackBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsRollbackOutput
    );
  }

  /**
   * @name Test AI gateway virtual model
   * @description Routes a request through the virtual model and shows which rule and models it picks. Nothing is sent to a provider, but the decision model is called and billed when a rule reads signals.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsTestBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsTestOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  test(
    instanceId: string,
    virtualModelId: string,
    body: DashboardInstanceAiGatewayVirtualModelsTestBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsTestOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/test`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsTestBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsTestOutput
    );
  }

  /**
   * @name Replay AI gateway virtual model requests
   * @description Routes the virtual model's most recent logged requests again, through the current definition or a draft, and shows which would be routed differently. Only requests whose content was logged are replayed. Logged decision model answers are reused while the signals are unchanged; otherwise the decision model is called and billed.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `body` - DashboardInstanceAiGatewayVirtualModelsReplayBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsReplayOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  replay(
    instanceId: string,
    virtualModelId: string,
    body: DashboardInstanceAiGatewayVirtualModelsReplayBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsReplayOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/replay`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayVirtualModelsReplayBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsReplayOutput
    );
  }
}
