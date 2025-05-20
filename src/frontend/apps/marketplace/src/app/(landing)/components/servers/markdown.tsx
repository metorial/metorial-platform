'use client';

import Markdown from 'react-markdown';
import { stripMarkdown } from './stripMarkdown';

export let RenderMarkdown = ({
  text,
  mode
}: {
  text: string;
  mode?: 'no-formatting' | 'simple-formatting';
}) => {
  let stripped = stripMarkdown(text, mode);

  return <Markdown>{stripped}</Markdown>;
};
