import { useAgentTrackingInstanceSettings } from '@metorial/state';
import { useAgentTrackingAvailability } from '../access';
import { showDeleteTeamViewDialog, showTeamViewNameDialog } from './dialogs';
import type { SavedTeamView } from './saved';
import { canSaveTeamView, useTeamViewSearch } from './state';

export let useTeamViewActions = (d: {
  instanceId: string | undefined;
  onTeamPage: boolean;
}) => {
  let { canWrite } = useAgentTrackingAvailability();
  let settings = useAgentTrackingInstanceSettings(d.instanceId);
  let { current, apply } = useTeamViewSearch();

  // The sidebar renders outside the Team page's privacy gate, so check the setting here too.
  let canCreate = canWrite && settings.data?.privacy.hideIndividuals === false;

  let latestSavable = () => {
    let latest = current();
    return canSaveTeamView(latest.state) ? latest : null;
  };

  let saveAsNew = () => {
    let latest = latestSavable();
    if (!d.instanceId || !latest) return;

    showTeamViewNameDialog({
      mode: 'save',
      instanceId: d.instanceId,
      view: latest.state,
      onSaved: created => apply(latest.state, created.id)
    });
  };

  let rename = (savedView: SavedTeamView) => {
    if (!d.instanceId) return;
    showTeamViewNameDialog({ mode: 'rename', instanceId: d.instanceId, savedView });
  };

  let remove = (savedView: SavedTeamView) => {
    if (!d.instanceId) return;

    showDeleteTeamViewDialog({
      instanceId: d.instanceId,
      savedView,
      onDeleted: () => {
        let latest = current();
        if (d.onTeamPage && latest.savedId == savedView.id) apply(latest.state, null);
      }
    });
  };

  return { canWrite, canCreate, latestSavable, saveAsNew, rename, remove };
};
