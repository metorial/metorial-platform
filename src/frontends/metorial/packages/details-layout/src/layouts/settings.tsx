import { PageHeaderSection } from '@metorial/layout';
import React from 'react';

export type DetailsSettingsLayoutProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
};

export let DetailsSettingsLayout = ({
  title = 'Settings',
  description,
  children
}: DetailsSettingsLayoutProps) => (
  <PageHeaderSection title={title} description={description} size="5">
    {children}
  </PageHeaderSection>
);
