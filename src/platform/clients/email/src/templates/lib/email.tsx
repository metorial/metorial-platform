import { render } from '@react-email/components';
import React from 'react';
import { Wrapper } from '../components/wrapper';

export interface IEmail {
  subject: string;
  html: string | Promise<string>;
  text: string | Promise<string>;
}

export let createEmail = ({
  content,
  preview,
  subject
}: {
  content: React.ReactElement;
  preview?: string;
  subject: string;
}) => {
  let inner = <Wrapper preview={preview}>{content}</Wrapper>;

  let html = render(inner, { plainText: false });
  let text = render(inner, { plainText: true });

  return {
    subject,
    html,
    text
  };
};
