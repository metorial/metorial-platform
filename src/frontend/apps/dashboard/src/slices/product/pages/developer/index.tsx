import { renderWithLoader } from '@metorial/data-hooks';
import { styled } from 'styled-components';
import { InstanceSelector, useSelectedInstance } from '../../components/instance';
import { ApiKeysScene } from './scenes/apiKeys';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ProjectDeveloperPage = () => {
  let instance = useSelectedInstance();

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
          extra={
            <div style={{ width: 300, marginBottom: 20 }}>
              <InstanceSelector />
            </div>
          }
        />
      ))}
    </>
  );
};
