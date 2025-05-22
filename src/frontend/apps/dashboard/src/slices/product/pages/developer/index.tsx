import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ApiKeysScene } from '../../scenes/apiKeys';

export let ProjectDeveloperPage = () => {
  let instance = useCurrentInstance();

  return (
    <>
      {renderWithLoader({ instance })(({ instance }) => (
        <ApiKeysScene
          header={{
            title: 'Developer',
            description: 'Manage your API keys and applications.'
          }}
          filter={{
            type: 'instance_access_token',
            instanceId: instance.data?.id
          }}
        />
      ))}
    </>
  );
};
