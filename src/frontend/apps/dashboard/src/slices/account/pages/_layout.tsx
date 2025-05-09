import { AppLayout, ContentLayout, OssApplicationLayoutNav } from '@metorial/layout';
import { RiUserSettingsLine } from '@remixicon/react';
import { Outlet } from 'react-router-dom';

export let AccountPageLayout = () => {
  return (
    <AppLayout
      Nav={OssApplicationLayoutNav}
      id="account"
      mainGroups={[
        {
          label: 'Account',
          items: [
            {
              icon: <RiUserSettingsLine />,
              label: 'Home',
              to: '/account',
              getProps: ({ pathname }) => ({
                isActive: pathname === '/account'
              })
            }
          ]
        }
      ]}
    >
      <ContentLayout>
        <Outlet />
      </ContentLayout>
    </AppLayout>
  );
};
