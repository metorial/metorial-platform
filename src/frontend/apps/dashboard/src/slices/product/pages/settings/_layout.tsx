import { ContentLayout } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let ProjectSettingsPageLayout = () => {
  return (
    <ContentLayout>
      <Outlet />
    </ContentLayout>
  );
};
