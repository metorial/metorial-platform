import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import type { ISidebarGroup, ISidebarItem } from '@metorial/layout';
import {
  useAgentTrackingViews,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import { toast } from '@metorial/ui';
import { RiAddLine, RiBookmarkLine, RiQuestionLine } from '@remixicon/react';
import { useLocation } from 'react-router-dom';
import { useAgentTrackingAvailability } from '../access';
import { useTeamViewActions } from './actions';
import { teamViewKinds, teamViewDefinitions } from './definitions';
import { savedViewsQuery, sortSavedViews, type SavedTeamView } from './saved';
import {
  activeTeamViewKind,
  canSaveTeamView,
  defaultTeamView,
  fromSavedView,
  isTeamPath,
  parseTeamViewSearch,
  teamViewHref
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
  let { available } = useAgentTrackingAvailability();
  let { instance, teamPath } = usePaths();
  let location = useLocation();

  let enabled = opts.enabled && available;
  let instanceId = enabled ? instance.data?.id : undefined;
  let onTeamPage = isTeamPath(location.pathname, teamPath);
  let views = useAgentTrackingViews(instanceId, savedViewsQuery);
  let actions = useTeamViewActions({ instanceId, onTeamPage });

  if (!instanceId) return [];

  let { state, savedId } = parseTeamViewSearch(new URLSearchParams(location.search));
  let list = views.data ? sortSavedViews(views.data.items) : [];

  let onCreate =
    actions.canCreate && onTeamPage && canSaveTeamView(state) ? actions.saveAsNew : undefined;

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
      menu: actions.canWrite
        ? [
            { label: 'Rename', action: () => actions.rename(view) },
            { label: 'Delete', action: () => actions.remove(view) }
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
