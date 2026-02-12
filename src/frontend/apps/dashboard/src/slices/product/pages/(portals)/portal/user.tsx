import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortal,
  usePortalConsumerGroups,
  usePortalConsumerProfile,
  useSsoTenantProfiles
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Checkbox,
  Entity,
  Flex,
  Panel,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PortalGroupAccess } from '../../../scenes/portals/groupAccess';

export let PortalUserPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);
  let user = usePortalConsumerProfile(instance.data?.instanceId, params.portalId!, params.userId!);
  let userOuter = user;
  let profiles = useSsoTenantProfiles(instance.data?.instanceId, {
    consumerProfileId: params.userId!,
    limit: 100
  });

  let assignGroups = user.useAssignGroupsMutator();
  let unassignGroups = user.useUnassignGroupsMutator();

  let personalGroup = user.data?.groups?.find(g => g.assignedVia === 'user');

  return (
    <>
      {renderWithLoader({ portal, user, profiles })(({ portal, user, profiles }) => (
        <>
          <Attributes
            itemWidth="300px"
            attributes={[
              {
                label: 'Name',
                content: user.data.name
              },
              {
                label: 'User ID',
                content: <ID id={user.data.id} />
              },
              {
                label: 'Created At',
                content: <RenderDate date={user.data.createdAt!} />
              }
            ]}
          />

          {!!profiles.data.items.length && (
            <>
              <Spacer height={15} />

              <Box title="SSO Profiles" description="SSO profiles linked to this user">
                <Table
                  headers={['Info', 'ID', 'SSO Tenant', 'Groups', 'Created']}
                  data={profiles.data.items.map(profile => ({
                    data: [
                      <Flex gap={3} direction="column">
                        <Text size="2" weight="strong">
                          {profile.firstName} {profile.lastName}
                        </Text>
                        <Text size="1" color="gray600" truncate>
                          {profile.email}
                        </Text>
                      </Flex>,
                      <ID id={profile.id} />,
                      profile.ssoTenant.name,
                      profile.groups.length
                        ? profile.groups.map(g => g).join(', ')
                        : 'No Groups',
                      <RenderDate date={profile.createdAt} />
                    ]
                  }))}
                />
              </Box>
            </>
          )}

          <Spacer height={15} />

          <Box
            title="Groups"
            description="Groups control the resources this user has access to."
            rightActions={
              <Button
                size="2"
                onClick={() =>
                  showModal(({ dialogProps, close }) => {
                    let [selected, setSelected] = useState<string[]>([]);
                    let groups = usePortalConsumerGroups(instance.data?.instanceId, portal.data?.id!);

                    return (
                      <Panel.Wrapper {...dialogProps}>
                        <Panel.Header>
                          <Panel.Title>Assign Groups</Panel.Title>
                          <Panel.Description>
                            Assign this user to additional consumer groups.
                          </Panel.Description>
                        </Panel.Header>

                        <Panel.Content>
                          {renderWithPagination(groups)(groups =>
                            groups.data.items.map(group => (
                              <div
                                key={group.id}
                                onClick={() => {
                                  setSelected(prev => {
                                    if (prev.includes(group.id)) {
                                      return prev.filter(id => id !== group.id);
                                    } else {
                                      return [...prev, group.id];
                                    }
                                  });
                                }}
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
                                            checked={selected.includes(group.id)}
                                            onCheckedChange={v =>
                                              setSelected(prev => {
                                                if (prev.includes(group.id)) {
                                                  return prev.filter(id => id !== group.id);
                                                } else {
                                                  return [...prev, group.id];
                                                }
                                              })
                                            }
                                            label="Select Group"
                                            hideLabel
                                          />
                                        </div>
                                      }
                                      title={group.name}
                                      description={group.description}
                                    />
                                  </Entity.Content>
                                </Entity.Wrapper>
                              </div>
                            ))
                          )}

                          <Spacer height={15} />

                          <Button
                            fullWidth
                            size="2"
                            disabled={!selected}
                            onClick={async () => {
                              if (!selected) return;
                              let [res] = await assignGroups.mutate({
                                groupIds: selected
                              });
                              if (res) {
                                userOuter.refetch();
                                close();
                              }
                            }}
                          >
                            Add Groups
                          </Button>
                        </Panel.Content>
                      </Panel.Wrapper>
                    );
                  })
                }
              >
                Assign Groups
              </Button>
            }
          >
            <Table
              headers={['Info', 'Assigned Via', 'ID', '']}
              data={user.data.groups!.map(group => ({
                data: [
                  group.group.name,
                  {
                    default: (
                      <Badge size="1" color="blue">
                        Default
                      </Badge>
                    ),
                    manual: (
                      <Badge size="1" color="orange">
                        Manual
                      </Badge>
                    ),
                    sso: (
                      <Badge size="1" color="purple">
                        SSO
                      </Badge>
                    ),
                    user: (
                      <Badge size="1" color="gray">
                        Personal Group
                      </Badge>
                    )
                  }[group.assignedVia],
                  <ID id={group.group.id} />,

                  <Flex justify="end" style={{ width: '100%' }}>
                    <Button
                      size="1"
                      variant="outline"
                      disabled={group.assignedVia != 'manual'}
                      title={
                        group.assignedVia != 'manual'
                          ? `Group is assigned automatically and can't be unassigned`
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

            {user.data.groups!.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                This user is not assigned to any groups.
              </Text>
            )}
          </Box>

          {personalGroup && (
            <>
              <Spacer height={20} />
              <PortalGroupAccess portalId={portal.data.id} groupId={personalGroup.group.id} />
            </>
          )}
        </>
      ))}
    </>
  );
};
