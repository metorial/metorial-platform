import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsCommentThreadsCommentsCreateBody,
  mapDashboardInstanceDocumentsCommentThreadsCommentsCreateOutput,
  mapDashboardInstanceDocumentsCommentThreadsCommentsDeleteOutput,
  mapDashboardInstanceDocumentsCommentThreadsCommentsUpdateBody,
  mapDashboardInstanceDocumentsCommentThreadsCommentsUpdateOutput,
  type DashboardInstanceDocumentsCommentThreadsCommentsCreateBody,
  type DashboardInstanceDocumentsCommentThreadsCommentsCreateOutput,
  type DashboardInstanceDocumentsCommentThreadsCommentsDeleteOutput,
  type DashboardInstanceDocumentsCommentThreadsCommentsUpdateBody,
  type DashboardInstanceDocumentsCommentThreadsCommentsUpdateOutput
} from '../resources';

/**
 * @name Document Comments controller
 * @description Reply to, edit, and delete comments in a document comment thread.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceDocumentsCommentThreadsCommentsEndpoint {
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
   * @name Reply to document comment thread
   * @description Adds a comment to an existing comment thread.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `body` - DashboardInstanceDocumentsCommentThreadsCommentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsCommentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    documentId: string,
    documentCommentThreadId: string,
    body: DashboardInstanceDocumentsCommentThreadsCommentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsCommentsCreateOutput> {
    let path = `instances/${instanceId}/documents/${documentId}/comment-threads/${documentCommentThreadId}/comments`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCommentThreadsCommentsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsCommentsCreateOutput
    );
  }

  /**
   * @name Update document comment
   * @description Edits a comment. Only the comment author can edit it.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `documentCommentId` - string
   * @param `body` - DashboardInstanceDocumentsCommentThreadsCommentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsCommentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    documentId: string,
    documentCommentThreadId: string,
    documentCommentId: string,
    body: DashboardInstanceDocumentsCommentThreadsCommentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsCommentsUpdateOutput> {
    let path = `instances/${instanceId}/documents/${documentId}/comment-threads/${documentCommentThreadId}/comments/${documentCommentId}`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCommentThreadsCommentsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsCommentsUpdateOutput
    );
  }

  /**
   * @name Delete document comment
   * @description Deletes a comment. Only the comment author can delete it.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `documentCommentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsCommentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    documentId: string,
    documentCommentThreadId: string,
    documentCommentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsCommentsDeleteOutput> {
    let path = `instances/${instanceId}/documents/${documentId}/comment-threads/${documentCommentThreadId}/comments/${documentCommentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsCommentsDeleteOutput
    );
  }
}
