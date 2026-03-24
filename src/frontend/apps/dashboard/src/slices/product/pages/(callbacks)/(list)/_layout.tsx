import { ContentLayout, PageHeader } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let CallbacksListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Callbacks"
        description="Don't call us, we call you. Let your deployed providers notify your application when callback triggers fire."
      />

      <Outlet />
    </ContentLayout>
  );
};
