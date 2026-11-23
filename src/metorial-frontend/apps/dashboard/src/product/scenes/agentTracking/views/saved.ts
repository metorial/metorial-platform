import { maxSavedViews, type TeamViewKind, type TeamViewState } from './definitions';
import { fromSavedView } from './state';

type SavedViewLike = { id: string; name: string; kind: string; params: unknown };

type ErrorData =
  | {
      status?: unknown;
      code?: unknown;
      errors?: { message?: unknown; path?: unknown }[];
    }
  | null
  | undefined;

export type SavedSelection<View> =
  | { status: 'none' | 'loading' | 'error' | 'unavailable' }
  | { status: 'found'; view: View; state: TeamViewState };

export let sortSavedViews = <View extends SavedViewLike>(views: View[]) =>
  [...views].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export let resolveSavedSelection = <View extends SavedViewLike>(d: {
  savedId: string | null;
  urlKind: TeamViewKind;
  views: View[] | null;
  listFailed: boolean;
}): SavedSelection<View> => {
  if (!d.savedId) return { status: 'none' };

  let view = d.views?.find(item => item.id == d.savedId);
  if (!view) return { status: d.listFailed ? 'error' : d.views ? 'unavailable' : 'loading' };

  let state = fromSavedView(view);
  if (!state || state.kind != d.urlKind) return { status: 'unavailable' };

  return { status: 'found', view, state };
};

export let savedViewErrorMessage = (error: ErrorData) => {
  if (!error) return null;
  if (error.status == 409 || error.code == 'conflict') {
    return 'A saved view with this name already exists. Choose another name.';
  }
  if (error.code == 'view_limit_exceeded') {
    return `This instance already has ${maxSavedViews} saved views, the most it can have. Delete one to save another.`;
  }

  let nameError = error.errors?.find(
    item => Array.isArray(item.path) && item.path.length == 1 && item.path[0] == 'name'
  );
  return error.code == 'invalid_data' && typeof nameError?.message == 'string'
    ? nameError.message
    : null;
};
