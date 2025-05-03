import React from 'react';
import { ContentPage } from '../content';

export let ErrorPage = ({ title, description }: { title: string; description: string }) => (
  <ContentPage title={title} description={description} />
);
