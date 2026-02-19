import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Explainer } from '../../../../components/explainer';
import { ApiKeysScene } from '../../scenes/apiKeys';

export let ProjectDeveloperPage = () => {
  let instance = useCurrentInstance();

  return (
    <>
      {renderWithLoader({ instance })(({ instance }) => (
        <>
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

          <Explainer
            title="Integrating Metorial"
            description="Learn how to use the Metorial SDKs to give your AI agents access to the MCP tools."
            youtubeId="otdHro6fpK0"
            id="integration"
          />
        </>
      ))}
    </>
  );
};
