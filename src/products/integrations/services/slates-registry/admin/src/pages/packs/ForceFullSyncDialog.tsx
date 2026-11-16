import { Button, Callout, Checkbox, Dialog, Flex, Text, useDialog } from '@metorial-io/ui';
import { useState } from 'react';
import { useForceFullSync } from '../../hooks';

export let ForceFullSyncDialog = (p: {
  tenantId: string;
  subRegistry: { identifier: string; name: string };
  disabled?: boolean;
}) => {
  let dialog = useDialog();
  let forceFullSync = useForceFullSync();
  let [reset, setReset] = useState(false);
  let [rewindFeed, setRewindFeed] = useState(false);

  let close = () => {
    dialog.state.onOpenChange(false);
    setReset(false);
    setRewindFeed(false);
  };

  let submit = async () => {
    let [, error] = await forceFullSync.mutate({
      tenantId: p.tenantId,
      subRegistryIdentifier: p.subRegistry.identifier,
      reset,
      rewindFeed
    });
    if (!error) close();
  };

  return (
    <>
      <Button size="2" disabled={p.disabled} onClick={dialog.open}>
        Force Full Sync
      </Button>

      <Dialog.Wrapper
        isOpen={dialog.isOpen}
        onOpenChange={open => (open ? dialog.open() : close())}
        width={520}
      >
        <Dialog.Title>Force Full Sync</Dialog.Title>
        <Dialog.Description>
          Build a new full sync for {p.subRegistry.name} right now instead of waiting for the
          weekly one. It runs in the background and appears in the pack list when it is done.
        </Dialog.Description>

        <Flex direction="column" gap={16}>
          <Checkbox
            checked={rewindFeed}
            onCheckedChange={setRewindFeed}
            label="Rebuild incremental history"
            description="Walks every published version again and publishes the ones that were never packed as new incremental packs. Installations import them as normal updates. Use this after versions were missing from packs."
          />

          <Checkbox
            checked={reset}
            onCheckedChange={setReset}
            label="Reset all existing packs"
            description="Deletes every existing full sync and incremental pack file of this channel before building. Installations that have not imported them yet can only catch up from the new full sync."
          />

          {reset && (
            <Callout color="red">
              <Text size="2">
                The stored pack files are deleted permanently. This cannot be undone.
              </Text>
            </Callout>
          )}

          <forceFullSync.RenderError />

          <Flex gap={8} justify="end">
            <Button variant="soft" size="2" onClick={close}>
              Cancel
            </Button>
            <Button
              size="2"
              color={reset ? 'red' : undefined}
              loading={forceFullSync.isLoading}
              onClick={submit}
            >
              {reset ? 'Reset and Sync' : 'Start Full Sync'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Wrapper>
    </>
  );
};
