import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import type { ISidebarGroup, ISidebarItem } from '@metorial/layout';
import {
  useAgentTrackingInstanceSettings,
  useAgentTrackingViews,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import { toast } from '@metorial/ui';
import { RiAddLine, RiBookmarkLine, RiQuestionLine } from '@remixicon/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAgentTrackingAvailability } from '../access';
import { teamViewKinds, teamViewDefinitions, type TeamViewState } from './definitions';
import {
  savedViewsQuery,
  showDeleteTeamViewDialog,
  showRenameTeamViewDialog,
  showSaveTeamViewDialog,
  type SavedTeamView
} from './dialogs';
import { sortSavedViews } from './saved';
import {
  activeTeamViewKind,
  canSaveTeamView,
  defaultTeamView,
  fromSavedView,
  parseTeamViewSearch,
  teamViewHref,
  writeTeamViewSearch
} from './state';

let usePaths = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();

  let params = [organization.data, instance.data?.project, instance.data] as [
    EntityParam,
    EntityParam,
    EntityParam
  ];

  return { instance, teamPath: Paths.instance.agentTracking.team(...params) };
};

export let useTeamViewSidebarChildren = (): NonNullable<ISidebarItem['children']> => {
  let location = useLocation();
  let { teamPath } = usePaths();
  let active = activeTeamViewKind(location, teamPath);

  return teamViewKinds.map(kind => ({
    label: teamViewDefinitions[kind].label,
    to: teamViewHref(teamPath, defaultTeamView(kind), null),
    getProps: () => ({ isActive: active == kind })
  }));
};

export let useSavedTeamViewsSidebarGroups = (opts: { enabled: boolean }): ISidebarGroup[] => {
  let { available, canWrite } = useAgentTrackingAvailability();
  let { instance, teamPath } = usePaths();
  let location = useLocation();
  let navigate = useNavigate();

  let enabled = opts.enabled && available;
  let instanceId = enabled ? instance.data?.id : undefined;
  let views = useAgentTrackingViews(instanceId, savedViewsQuery);
  let settings = useAgentTrackingInstanceSettings(instanceId);

  if (!instanceId) return [];

  let onTeamPage = location.pathname.replace(/\/+$/, '') == teamPath.replace(/\/+$/, '');
  let { state, savedId } = parseTeamViewSearch(new URLSearchParams(location.search));
  let list = views.data ? sortSavedViews(views.data.items) : [];

  // Handlers read window.location, not the rendered location, so a threshold committed on blur
  // by the same click is already in the search they read.
  let latestSearch = () => new URLSearchParams(window.location.search);

  let openOnTeamPage = (view: TeamViewState, id: string | null) =>
    navigate(
      { search: writeTeamViewSearch(latestSearch(), view, id).toString() },
      { replace: true }
    );

  let onCreate =
    canWrite &&
    onTeamPage &&
    settings.data?.privacy.hideIndividuals === false &&
    canSaveTeamView(state)
      ? () => {
          let latest = parseTeamViewSearch(latestSearch()).state;
          if (!canSaveTeamView(latest)) return;

          showSaveTeamViewDialog({
            instanceId,
            view: latest,
            onSaved: created => openOnTeamPage(latest, created.id)
          });
        }
      : undefined;

  let toItem = (view: SavedTeamView): ISidebarItem => {
    let opened = fromSavedView(view);

    return {
      icon: opened ? <RiBookmarkLine /> : <RiQuestionLine />,
      label: view.name,
      to: opened ? teamViewHref(teamPath, opened, view.id) : undefined,
      onClick: opened
        ? undefined
        : () =>
            toast('This saved view cannot be opened here. It may come from a newer version.'),
      getProps: () => ({ isActive: onTeamPage && savedId == view.id }),
      menu: canWrite
        ? [
            {
              label: 'Rename',
              action: () => showRenameTeamViewDialog({ instanceId, savedView: view })
            },
            {
              label: 'Delete',
              action: () =>
                showDeleteTeamViewDialog({
                  instanceId,
                  savedView: view,
                  onDeleted: () => {
                    let current = parseTeamViewSearch(latestSearch());
                    if (onTeamPage && current.savedId == view.id) {
                      openOnTeamPage(current.state, null);
                    }
                  }
                })
            }
          ]
        : undefined
    };
  };

  return [
    {
      label: 'Saved Team Views',
      collapsible: true,
      enabled: list.length > 0 || !!onCreate,
      onCreate,
      items:
        views.data && !list.length && onCreate
          ? [{ icon: <RiAddLine />, label: 'Save Current View', onClick: onCreate }]
          : list.map(toItem)
    }
  ];
};
