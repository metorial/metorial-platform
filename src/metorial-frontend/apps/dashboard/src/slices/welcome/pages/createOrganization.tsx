import { SetupLayout } from '@metorial/layout';
import bg from '../../../assets/bg.webp';
import { WelcomeCreateOrganizationScene } from '../scenes/createOrganization';

export let WelcomeCreateOrganizationPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Workspace',
        description: `Let's get started by setting up your workspace.`
      }}
      backgroundUrl={bg}
    >
      <WelcomeCreateOrganizationScene />
    </SetupLayout>
  );
};
