import { renderWithLoader } from '@metorial/data-hooks';
import { useConsumerProfiles, useCurrentInstance } from '@metorial/state';
import { Select } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MagicMcpServersTable } from '../../../scenes/magicMcp/serversGrid';

let ALL_PROFILES_VALUE = '__all_profiles__';

export let ConsumerMagicMcpServersPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let profiles = useConsumerProfiles(instance.data?.id, consumerId, {
    order: 'desc',
    limit: 100
  });
  let [selectedProfileId, setSelectedProfileId] = useState(ALL_PROFILES_VALUE);

  useEffect(() => {
    setSelectedProfileId(ALL_PROFILES_VALUE);
  }, [consumerId]);

  let consumerProfileId =
    selectedProfileId === ALL_PROFILES_VALUE ? undefined : selectedProfileId;

  let items = [
    {
      id: ALL_PROFILES_VALUE,
      label: 'All profiles'
    },
    ...(profiles.data?.items ?? []).map(profile => ({
      id: profile.id,
      label: `${profile.name || profile.email || profile.id} (${profile.surface.name})`
    }))
  ];

  return renderWithLoader({ instance })(() => (
    <>
      <MagicMcpServersTable
        consumerId={consumerId}
        consumerProfileId={consumerProfileId}
        headerActions={
          <Select
            label="Profile"
            size="2"
            hideLabel
            items={items}
            value={selectedProfileId}
            onChange={value => setSelectedProfileId(value)}
          />
        }
      />
    </>
  ));
};
