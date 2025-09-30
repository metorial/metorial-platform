import { SetupLayout } from '@metorial/layout';
import bg from '../../../assets/bg.webp';
import { WelcomeCreateProjectScene } from '../scenes/createProject';

export let WelcomeCreateProjectPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Project',
        description: `Please choose a name for your new project.`
      }}
      backgroundUrl={bg}
    >
      <WelcomeCreateProjectScene />
    </SetupLayout>
  );
};
