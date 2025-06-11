import { SetupLayout } from '@metorial/layout';
import bg from '../../../assets/bg.webp';
import bubbles from '../../../assets/bubbles.svg';
import { WelcomeCreateOrganizationScene } from '../scenes/createOrganization';

export let WelcomeCreateOrganizationPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Workspace',
        description: `Let's get started by setting up your workspace.`
      }}
      bubblesUrl={bubbles}
      backgroundUrl={bg}
    >
      <WelcomeCreateOrganizationScene />
    </SetupLayout>
  );
};
