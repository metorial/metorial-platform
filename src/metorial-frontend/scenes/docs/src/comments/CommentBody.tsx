import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import { commentTypography } from './commentTypography';

let Body = styled.div`
  ${commentTypography}
`;

let allowedElements = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br'];

export let CommentBody = ({ markdown }: { markdown: string }) => (
  <Body>
    <ReactMarkdown allowedElements={allowedElements} unwrapDisallowed>
      {markdown}
    </ReactMarkdown>
  </Body>
);
