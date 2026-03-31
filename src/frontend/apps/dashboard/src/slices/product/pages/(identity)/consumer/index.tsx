import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useConsumer, useConsumerProfiles, useCurrentInstance } from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let getConsumerType = (consumer: {
  isOrganizationMember: boolean;
  isPortalConsumer: boolean;
}) => {
  if (consumer.isOrganizationMember) return 'Metorial Member';
  if (consumer.isPortalConsumer) return 'Portal Member';
  return 'Custom';
};

export let ConsumerPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);
  let profiles = useConsumerProfiles(instance.data?.id, consumerId, { order: 'desc' });

  return renderWithLoader({ consumer })(({ consumer }) => (
    <>
      <Attributes
        itemWidth="240px"
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
          },
          {
            label: 'Updated At',
            content: <RenderDate date={consumer.data.updatedAt} />
          }
        ]}
      />

      <Spacer size={20} />

      <Box title="Profiles" description="Profiles linked to this consumer across consumer surfaces.">
        {renderWithPagination(profiles)(profiles => (
          <>
            <Table
              headers={['Name', 'Email', 'Surface', 'Groups', 'Created']}
              data={profiles.data.items.map(profile => ({
                data: [
                  <Text size="2" weight="strong">
                    {profile.name}
                  </Text>,
                  <Text size="2">{profile.email}</Text>,
                  <div>
                    <Text size="2" weight="strong">
                      {profile.surface.name}
                    </Text>
                    <Text size="1" color="gray600">
                      {profile.surface.id}
                    </Text>
                  </div>,
                  profile.groups?.length ? (
                    <Badge color="gray">{profile.groups.length} groups</Badge>
                  ) : (
                    <Text size="2" color="gray600">
                      None
                    </Text>
                  ),
                  <RenderDate date={profile.createdAt} />
                ]
              }))}
            />

            {profiles.data.items.length === 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                No profiles for this consumer.
              </Text>
            )}
          </>
        ))}
      </Box>
    </>
  ));
};
