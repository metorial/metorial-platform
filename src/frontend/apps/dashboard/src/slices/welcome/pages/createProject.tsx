import { SetupLayout } from '@metorial/layout';
import bg from '../../../assets/bg.webp';
import bubbles from '../../../assets/bubbles.svg';
import { WelcomeCreateProjectScene } from '../scenes/createProject';

export let WelcomeCreateProjectPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Project',
        description: `Please choose a name for your new project.`
      }}
      bubblesUrl={bubbles}
      backgroundUrl={bg}
    >
      <WelcomeCreateProjectScene />
    </SetupLayout>
  );
};
