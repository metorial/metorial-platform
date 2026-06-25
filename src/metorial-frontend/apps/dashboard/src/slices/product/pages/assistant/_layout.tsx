import { ContentLayout } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let AssistantPageLayout = () => {
  return (
    <ContentLayout>
      <Outlet />
    </ContentLayout>
  );
};
