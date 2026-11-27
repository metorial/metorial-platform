/**
 * Reserved tool id the hub invokes when a proxied URL attachment's `refreshAfter` has
 * passed (see slateAttachmentRefreshService). Must match the id `getFileUrlTool()` in
 * `@slates/provider` assigns.
 */
export let GET_FILE_URL_TOOL_ID = 'metorial$getFileUrl';

/**
 * Reserved hub-internal tool ids. Never persisted as SlateAction rows, never surfaced in
 * a SlateSpecification's discovered actions, and never invokable from outside the hub --
 * the hub invokes them directly by their literal id, bypassing the normal discovery-backed
 * action lookup entirely.
 */
export let RESERVED_ACTION_IDS = new Set([GET_FILE_URL_TOOL_ID]);

export let isReservedActionId = (id: string) => RESERVED_ACTION_IDS.has(id);
