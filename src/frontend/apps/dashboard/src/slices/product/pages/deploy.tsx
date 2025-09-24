import { SetupLayout } from '@metorial/layout';
import { useServerListing } from '@metorial/state';
import { useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import { ServerDeploymentForm } from '../scenes/serverDeployments/form';

export let DeployPage = () => {
  let [search] = useSearchParams();
  let serverId = search.get('server_id');

  let serverListing = useServerListing(serverId);

  return (
    <SetupLayout
      main={
        serverListing.data
          ? {
              title: `Deploy ${serverListing.data.name}`,
              description: `Let's set up your server deployment.`
            }
          : undefined
      }
      backgroundUrl={bg}
    >
      {serverId && <ServerDeploymentForm type="create" for={{ serverId }} />}
    </SetupLayout>
  );
};
