import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortalConsumerGroups,
  usePortalConsumerProfile
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Entity,
  Flex,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PortalGroupAccess } from '../../scenes/portals/groupAccess';

let showAssignPortalGroupsModal = (props: {
  instanceId: string;
  portalId: string;
  assignedGroupIds: string[];
  onAssign: (groupIds: string[]) => Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let groups = usePortalConsumerGroups(props.instanceId, props.portalId, { limit: 100 });
    let [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>Assign Groups</Dialog.Title>
        <Dialog.Description>
          Assign this user to additional consumer groups.
        </Dialog.Description>

        {renderWithPagination(groups, {
          hidePaginationWhenUnavailable: true
        })(groups => {
          let availableGroups = groups.data.items.filter(
            group => !props.assignedGroupIds.includes(group.id)
          );

          return (
            <>
              {availableGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() =>
                    setSelectedGroupIds(current =>
                      current.includes(group.id)
                        ? current.filter(id => id !== group.id)
                        : [...current, group.id]
                    )
                  }
                >
                  <Entity.Wrapper>
                    <Entity.Content>
                      <Entity.Field
                        prefix={
                          <div
                            onClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                          >
                            <Checkbox
                              checked={selectedGroupIds.includes(group.id)}
                              onCheckedChange={() =>
                                setSelectedGroupIds(current =>
                                  current.includes(group.id)
                                    ? current.filter(id => id !== group.id)
                                    : [...current, group.id]
                                )
                              }
                              label="Select Group"
                              hideLabel
                            />
                          </div>
                        }
                        title={group.name}
                        value={group.description || 'No description'}
                      />
                    </Entity.Content>
                  </Entity.Wrapper>

                  <Spacer size={10} />
                </div>
              ))}

              {availableGroups.length === 0 && (
                <Text size="2" color="gray600">
                  All portal groups are already assigned to this user.
                </Text>
              )}

              <Dialog.Actions>
                <Button type="button" variant="soft" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={!selectedGroupIds.length}
                  onClick={async () => {
                    await props.onAssign(selectedGroupIds);
                    close();
                  }}
                >
                  Add Groups
                </Button>
              </Dialog.Actions>
            </>
          );
        })}
      </Dialog.Wrapper>
    );
  });

export let PortalUserPage = () => {
  let instance = useCurrentInstance();
  let { portalId, userId } = useParams();
  let user = usePortalConsumerProfile(instance.data?.id, portalId, userId);
  let assignGroups = user.useAssignGroupsMutator();
  let unassignGroups = user.useUnassignGroupsMutator();

  let personalGroup = user.data?.groups?.find(group => group.assignedVia === 'user');

  if (!portalId || !userId) return null;

  return renderWithLoader({ user })(({ user }) => (
    <>
      <Attributes
        itemWidth="280px"
        attributes={[
          {
            label: 'Name',
            content: user.data.name
          },
          {
            label: 'Email',
            content: user.data.email
          },
          {
            label: 'User ID',
            content: <ID id={user.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={user.data.createdAt} />
          }
        ]}
      />

      <Spacer size={15} />

      <Box
        title="Groups"
        description="Groups control the resources this user has access to."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showAssignPortalGroupsModal({
                instanceId: instance.data.id,
                portalId,
                assignedGroupIds: (user.data.groups ?? []).map(group => group.group.id),
                onAssign: async groupIds => {
                  await assignGroups.mutate({ groupIds });
                }
              })
            }
          >
            Assign Groups
          </Button>
        }
      >
        <Table
          headers={['Info', 'Assigned Via', 'ID', '']}
          data={(user.data.groups ?? []).map(group => ({
            data: [
              group.group.name,
              {
                default: <Badge color="blue">Default</Badge>,
                manual: <Badge color="orange">Manual</Badge>,
                sso: <Badge color="purple">SSO</Badge>,
                user: <Badge color="gray">Personal Group</Badge>
              }[group.assignedVia],
              <ID id={group.group.id} />,
              <Flex justify="end" style={{ width: '100%' }}>
                <Button
                  size="1"
                  variant="outline"
                  disabled={group.assignedVia !== 'manual'}
                  title={
                    group.assignedVia !== 'manual'
                      ? `This group is assigned automatically and can't be removed here.`
                      : 'Unassign group from user'
                  }
                  onClick={async () => {
                    await unassignGroups.mutate({
                      groupIds: [group.group.id]
                    });
                  }}
                >
                  Unassign
                </Button>
              </Flex>
            ]
          }))}
        />

        {(user.data.groups ?? []).length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            This user is not assigned to any groups.
          </Text>
        )}
      </Box>

      {personalGroup && (
        <>
          <Spacer size={20} />
          <PortalGroupAccess
            portalId={portalId}
            groupId={personalGroup.group.id}
            title="Personal Access"
            description="Manage the resources granted directly to this user."
          />
        </>
      )}
    </>
  ));
};
