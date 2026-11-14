import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsCommentThreadsCreateBody,
  mapDashboardInstanceDocumentsCommentThreadsCreateOutput,
  mapDashboardInstanceDocumentsCommentThreadsDeleteOutput,
  mapDashboardInstanceDocumentsCommentThreadsGetOutput,
  mapDashboardInstanceDocumentsCommentThreadsListOutput,
  mapDashboardInstanceDocumentsCommentThreadsListQuery,
  mapDashboardInstanceDocumentsCommentThreadsUpdateBody,
  mapDashboardInstanceDocumentsCommentThreadsUpdateOutput,
  type DashboardInstanceDocumentsCommentThreadsCreateBody,
  type DashboardInstanceDocumentsCommentThreadsCreateOutput,
  type DashboardInstanceDocumentsCommentThreadsDeleteOutput,
  type DashboardInstanceDocumentsCommentThreadsGetOutput,
  type DashboardInstanceDocumentsCommentThreadsListOutput,
  type DashboardInstanceDocumentsCommentThreadsListQuery,
  type DashboardInstanceDocumentsCommentThreadsUpdateBody,
  type DashboardInstanceDocumentsCommentThreadsUpdateOutput
} from '../resources';

/**
 * @name Document Comment Threads controller
 * @description Discuss selected text in a document through comment threads.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDocumentsCommentThreadsEndpoint {
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
   * @name List document comment threads
   * @description Returns a paginated list of comment threads for a specific document.
   *
   * @param `documentId` - string
   * @param `query` - DashboardInstanceDocumentsCommentThreadsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    documentId: string,
    query?: DashboardInstanceDocumentsCommentThreadsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsListOutput> {
    let path = `documents/${documentId}/comment-threads`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceDocumentsCommentThreadsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsListOutput
    );
  }

  /**
   * @name Get document comment thread by ID
   * @description Retrieves a specific comment thread with its comments.
   *
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    documentId: string,
    documentCommentThreadId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsGetOutput> {
    let path = `documents/${documentId}/comment-threads/${documentCommentThreadId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsGetOutput
    );
  }

  /**
   * @name Create document comment thread
   * @description Starts a comment thread on a text selection. Anyone who can read the document can comment.
   *
   * @param `documentId` - string
   * @param `body` - DashboardInstanceDocumentsCommentThreadsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    documentId: string,
    body: DashboardInstanceDocumentsCommentThreadsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsCreateOutput> {
    let path = `documents/${documentId}/comment-threads`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCommentThreadsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsCreateOutput
    );
  }

  /**
   * @name Update document comment thread
   * @description Resolves or reopens a comment thread. Allowed for the thread author and document editors.
   *
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `body` - DashboardInstanceDocumentsCommentThreadsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    documentId: string,
    documentCommentThreadId: string,
    body: DashboardInstanceDocumentsCommentThreadsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsUpdateOutput> {
    let path = `documents/${documentId}/comment-threads/${documentCommentThreadId}`;

    let request = {
      path,
      body: mapDashboardInstanceDocumentsCommentThreadsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsUpdateOutput
    );
  }

  /**
   * @name Delete document comment thread
   * @description Deletes a comment thread and removes its highlight. Requires document write access.
   *
   * @param `documentId` - string
   * @param `documentCommentThreadId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsCommentThreadsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    documentId: string,
    documentCommentThreadId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsCommentThreadsDeleteOutput> {
    let path = `documents/${documentId}/comment-threads/${documentCommentThreadId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceDocumentsCommentThreadsDeleteOutput
    );
  }
}
