import { ContentLayout } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let ProjectDeveloperPageLayout = () => {
  return (
    <ContentLayout>
      <Outlet />
    </ContentLayout>
  );
};
