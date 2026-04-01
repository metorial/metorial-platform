import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useAssignPortalConsumerProfileGroups,
  useCurrentInstance,
  usePortalConsumerGroups,
  usePortalConsumerProfiles,
  useUnassignPortalConsumerProfileGroups
} from '@metorial/state';
import {
  Button,
  Dialog,
  Entity,
  MultiSelect,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let ProfileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let showPortalProfileGroupsModal = (props: {
  action: 'assign' | 'unassign';
  instanceId: string;
  portalId: string;
  consumerProfileId: string;
  selectedGroupIds: string[];
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let groups = usePortalConsumerGroups(props.instanceId, props.portalId, { limit: 100 });
    let assignGroups = useAssignPortalConsumerProfileGroups();
    let unassignGroups = useUnassignPortalConsumerProfileGroups();
    let groupItems = (groups.data?.items ?? []).map(group => ({
      id: group.id,
      label: group.name
    }));

    let form = useForm({
      initialValues: {
        groupIds: props.selectedGroupIds
      },
      schema: yup =>
        yup.object({
          groupIds: yup.array(yup.string()).min(1, 'Choose at least one group')
        }),
      onSubmit: async values => {
        let mutate = props.action == 'assign' ? assignGroups : unassignGroups;
        let [updated] = await mutate.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerProfileId: props.consumerProfileId,
          body: {
            groupIds: values.groupIds
          }
        });

        if (!updated) return;

        props.onComplete();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>
          {props.action == 'assign' ? 'Assign Groups' : 'Unassign Groups'}
        </Dialog.Title>
        <Dialog.Description>
          {props.action == 'assign'
            ? 'Assign the selected consumer groups to this profile.'
            : 'Remove the selected consumer groups from this profile.'}
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <MultiSelect
            label="Groups"
            value={form.values.groupIds}
            items={groupItems}
            onChange={value => form.setFieldValue('groupIds', value)}
            placeholder="Select groups"
          />
          <form.RenderError field="groupIds" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assignGroups.isLoading || unassignGroups.isLoading}
            >
              {props.action == 'assign' ? 'Assign' : 'Unassign'}
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalConsumerProfilesPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let profiles = usePortalConsumerProfiles(instance.data?.id, portalId);

  if (!portalId) return null;

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      {renderWithPagination(profiles, {
        hidePaginationWhenUnavailable: true
      })(profilesPage => (
        <ProfileList>
          {profilesPage.data.items.map(profile => {
            let currentGroupIds = profile.groups?.map(group => group.group.id) ?? [];

            return (
              <Entity.Wrapper key={profile.id}>
                <Entity.Content>
                  <Entity.Field
                    title={profile.name}
                    value={profile.email}
                  />
                  <Entity.Field
                    title="Groups"
                    value={
                      profile.groups?.length
                        ? profile.groups
                            .map(group => `${group.group.name} (${group.assignedVia})`)
                            .join(', ')
                        : 'No groups'
                    }
                  />
                  <Entity.Field
                    title="Actions"
                    right
                    value={
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="1"
                          onClick={() =>
                            showPortalProfileGroupsModal({
                              action: 'assign',
                              instanceId: instance.data.id,
                              portalId,
                              consumerProfileId: profile.id,
                              selectedGroupIds: currentGroupIds,
                              onComplete: () => profiles.refetch()
                            })
                          }
                        >
                          Assign
                        </Button>
                        <Button
                          size="1"
                          variant="outline"
                          disabled={!currentGroupIds.length}
                          onClick={() =>
                            showPortalProfileGroupsModal({
                              action: 'unassign',
                              instanceId: instance.data.id,
                              portalId,
                              consumerProfileId: profile.id,
                              selectedGroupIds: currentGroupIds,
                              onComplete: () => profiles.refetch()
                            })
                          }
                        >
                          Unassign
                        </Button>
                      </div>
                    }
                  />
                </Entity.Content>
              </Entity.Wrapper>
            );
          })}

          {profilesPage.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No consumer profiles exist for this portal yet.
            </Text>
          )}
        </ProfileList>
      ))}
    </>
  ));
};
