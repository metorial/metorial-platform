import { ContentLayout, PageHeader } from '@metorial/layout';
import { Outlet } from 'react-router-dom';

export let CallbacksListLayout = () => {
  return (
    <ContentLayout>
      <PageHeader
        title="Callbacks"
        description="Don't call us, we call you. Let your MCP servers on Metorial notify your application about various events. Callbacks are automatically created for MCP servers that support them."
      />

      <Outlet />
    </ContentLayout>
  );
};
