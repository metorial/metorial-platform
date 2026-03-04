import { Group } from '@metorial/ui';
import React from 'react';
import { Form, FormProps } from './form';

export let FormBox = <Values extends Record<string, unknown>>(
  p: FormProps<Values> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    rightActions?: React.ReactNode;
  }
) => {
  let FormComponent: (props: FormProps<Values>) => React.ReactElement | null = Form;

  return React.createElement(Group.Wrapper, {
    children: [
      React.createElement(Group.Header, {
        title: p.title,
        description: p.description,
        actions: p.rightActions,
        key: 1
      }),
      React.createElement(Group.Content, {
        children: React.createElement(FormComponent, p),
        key: 2
      })
    ]
  });
};
