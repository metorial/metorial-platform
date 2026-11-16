import { css } from 'styled-components';

export let commentTypography = css`
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.color.text};
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }

  p + p,
  p + ul,
  p + ol,
  ul + p,
  ol + p {
    margin-top: 6px;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 20px;
  }

  li > p {
    margin: 0;
  }

  strong {
    font-weight: 600;
  }
`;
