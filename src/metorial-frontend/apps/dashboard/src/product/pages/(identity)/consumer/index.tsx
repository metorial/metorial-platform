import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useConsumer,
  useConsumerProfiles,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityActors
} from '@metorial/state';
import { Attributes, Avatar, Badge, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';

let getConsumerType = (consumer: {
  isOrganizationMember: boolean;
  isPortalConsumer: boolean;
}) => {
  if (consumer.isOrganizationMember) return 'Metorial Member';
  if (consumer.isPortalConsumer) return 'Portal Member';
  return 'Custom';
};

export let ConsumerPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let identityPaths = useIdentityPaths();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);
  let profiles = useConsumerProfiles(instance.data?.id, consumerId, { order: 'desc' });
  let actors = useIdentityActors(instance.data?.id, {
    consumerId,
    order: 'desc'
  });

  return renderWithLoader({ consumer, organization, project, instance })(
    ({ consumer, organization, project, instance }) => (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={consumer.data.id} />
            },
            {
              label: 'Email',
              content: consumer.data.email
            },
            {
              label: 'Type',
              content: getConsumerType(consumer.data)
            },
            {
              label: 'Metorial Member',
              content: consumer.data.isOrganizationMember ? 'Yes' : 'No'
            },
            {
              label: 'Portal Member',
              content: consumer.data.isPortalConsumer ? 'Yes' : 'No'
            },
            {
              label: 'Created At',
              content: <RenderDate date={consumer.data.createdAt} />
            }
          ]}
        />

        <Spacer size={20} />

        <Box
          title="Profiles"
          description="Profiles linked to this account across account portals."
        >
          {renderWithPagination(profiles)(profiles => (
            <>
              <Table
                headers={['Name', 'Email', 'Portal', 'Groups', 'ID', 'Created']}
                data={profiles.data.items.map(profile => ({
                  data: [
                    <Text size="2" weight="strong">
                      {profile.name}
                    </Text>,
                    <Text size="2">{profile.email}</Text>,
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar
                        entity={{ name: profile.surface.name }}
                        size={26}
                        radius={8}
                        withInitials
                        noTooltip
                      />
                      <Text size="2" weight="strong">
                        {profile.surface.name}
                      </Text>
                    </div>,
                    profile.groups?.length ? (
                      <Text>{profile.groups.length} groups</Text>
                    ) : (
                      <Text size="2" color="gray600">
                        None
                      </Text>
                    ),
                    <ID id={profile.id} />,
                    <RenderDate date={profile.createdAt} />
                  ]
                }))}
              />

              {profiles.data.items.length === 0 && (
                <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                  No profiles for this account.
                </Text>
              )}
            </>
          ))}
        </Box>

        <Spacer size={20} />

        <Box title="Agents" description="Agents that were used by this account.">
          {renderWithPagination(actors)(actors => {
            let agentActors = actors.data.items.filter(actor => !!actor.agentId);

            return (
              <>
                <Table
                  headers={['Actor', 'Agent ID', 'Status', 'Created']}
                  data={agentActors.map(actor => ({
                    href: identityPaths.actor(
                      organization.data,
                      project.data,
                      instance.data,
                      actor.id
                    ),
                    data: [
                      <Text size="2" weight="strong">
                        {actor.name}
                      </Text>,
                      actor.agentId ? <ID id={actor.agentId} /> : '—',
                      <Badge
                        color={
                          actor.status === 'active'
                            ? 'green'
                            : actor.status === 'archived'
                              ? 'orange'
                              : 'gray'
                        }
                      >
                        {actor.status}
                      </Badge>,
                      <RenderDate date={actor.createdAt} />
                    ]
                  }))}
                />

                {agentActors.length === 0 && (
                  <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                    No agent-backed actors linked to this account.
                  </Text>
                )}
              </>
            );
          })}
        </Box>

        <Spacer size={20} />

        <Box title="Actors" description="Identity actors linked to this account.">
          {renderWithPagination(actors)(actors => (
            <>
              <Table
                headers={['Name', 'Type', 'Status', 'Created']}
                data={actors.data.items.map(actor => ({
                  href: identityPaths.actor(
                    organization.data,
                    project.data,
                    instance.data,
                    actor.id
                  ),
                  data: [
                    <div>{actor.name}</div>,
                    <Text size="2">{actor.type === 'agent' ? 'Agent' : 'Person'}</Text>,
                    <Badge
                      color={
                        actor.status === 'active'
                          ? 'green'
                          : actor.status === 'archived'
                            ? 'orange'
                            : 'gray'
                      }
                    >
                      {actor.status}
                    </Badge>,
                    <RenderDate date={actor.createdAt} />
                  ]
                }))}
              />

              {actors.data.items.length === 0 && (
                <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                  No actors for this account.
                </Text>
              )}
            </>
          ))}
        </Box>
      </>
    )
  );
};
