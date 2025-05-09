import { SetupLayout } from '@metorial/layout';
import astronaut from '../../../assets/astronaut_waving1.webp';
import { WelcomeSetupProjectScene } from '../scenes/setupProject';

export let WelcomeSetupProjectPage = () => {
  return (
    <SetupLayout
      main={{
        title: `Set up Project`,
        description: `Let's set you up with a project. Do you want to start from scratch or continue with a demo project?`
      }}
      imageUrl={astronaut}
    >
      <WelcomeSetupProjectScene />
    </SetupLayout>
  );
};
