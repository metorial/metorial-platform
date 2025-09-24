import { SetupLayout } from '@metorial/layout';
import bg from '../../../assets/bg.webp';
import { WelcomeSetupProjectScene } from '../scenes/setupProject';

export let WelcomeSetupProjectPage = () => {
  return (
    <SetupLayout
      main={{
        title: `Set up Project`,
        description: `Let's set you up with a project. Do you want to start from scratch or continue with a demo project?`
      }}
      backgroundUrl={bg}
    >
      <WelcomeSetupProjectScene />
    </SetupLayout>
  );
};
