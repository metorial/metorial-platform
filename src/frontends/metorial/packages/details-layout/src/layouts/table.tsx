import { PageHeaderSection } from '@metorial/layout';
import React from 'react';

export type DetailsTableLayoutProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
};

export let DetailsTableLayout = ({
  title,
  description,
  children
}: DetailsTableLayoutProps) => (
  <PageHeaderSection title={title} description={description} size="5">
    {children}
  </PageHeaderSection>
);
