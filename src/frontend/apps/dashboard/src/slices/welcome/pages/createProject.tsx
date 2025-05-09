import { SetupLayout } from '@metorial/layout';
import astronaut from '../../../assets/astronaut_waving1.webp';
import { WelcomeCreateProjectScene } from '../scenes/createProject';

export let WelcomeCreateProjectPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Project',
        description: `Please choose a name for your new project.`
      }}
      imageUrl={astronaut}
    >
      <WelcomeCreateProjectScene />
    </SetupLayout>
  );
};
