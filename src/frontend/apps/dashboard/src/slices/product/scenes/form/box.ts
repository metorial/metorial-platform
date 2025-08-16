import { Group } from '@metorial/ui';
import React from 'react';
import { Form, FormProps } from './form';

export let FormBox = <Values extends {}>(
  p: FormProps<Values> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    rightActions?: React.ReactNode;
  }
) => {
  // return React.createElement(
  //   Box,
  //   {
  //     title: p.title,
  //     description: p.description,
  //     rightActions: p.rightActions
  //   } as any,
  //   React.createElement(Form, p as any, p.children)
  // );

  return React.createElement(Group.Wrapper, {
    children: [
      React.createElement(Group.Header, {
        title: p.title,
        description: p.description,
        actions: p.rightActions,
        key: 1
      }),
      React.createElement(Group.Content, {
        children: React.createElement(Form, p as any, p.children),
        key: 2
      })
    ]
  });
};
