import { SetupLayout } from '@metorial/layout';
import astronaut from '../../../assets/astronaut_waving1.webp';
import { WelcomeCreateOrganizationScene } from '../scenes/createOrganization';

export let WelcomeCreateOrganizationPage = () => {
  return (
    <SetupLayout
      main={{
        title: 'Create Workspace',
        description: `Let's get started by setting up your workspace.`
      }}
      imageUrl={astronaut}
    >
      <WelcomeCreateOrganizationScene />
    </SetupLayout>
  );
};
