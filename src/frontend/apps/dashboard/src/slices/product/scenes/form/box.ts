import { Group } from '@metorial/ui';
import React from 'react';
import { Form, FormProps } from './form';

export let FormBox = (
  p: FormProps<Record<string, any>> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    rightActions?: React.ReactNode;
  }
) => {
  return React.createElement(Group.Wrapper, {
    children: [
      React.createElement(Group.Header, {
        title: p.title,
        description: p.description,
        actions: p.rightActions,
        key: 1
      }),
      React.createElement(Group.Content, {
        children: React.createElement(Form, p as any),
        key: 2
      })
    ]
  });
};
