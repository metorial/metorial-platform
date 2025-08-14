import { Box } from '@metorial/ui-product';
import React from 'react';
import { Form, FormProps } from './form';

export let FormBox = <Values extends {}>(
  p: FormProps<Values> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    rightActions?: React.ReactNode;
  }
) => {
  return React.createElement(
    Box,
    {
      title: p.title,
      description: p.description,
      rightActions: p.rightActions
    } as any,
    React.createElement(Form, p as any, p.children)
  );
};
