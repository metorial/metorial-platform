'use client';

import { Logo } from '@metorial/ui';
import { styled } from 'styled-components';

let Wrapper = styled('footer')`
  border-top: 1px solid #ddd;

  & > div {
    max-width: 1000px;
    margin: 0px auto;
    padding: 60px 20px;

    @media screen and (max-width: 800px) {
      padding: 20px;
    }
  }
`;

let TopRow = styled('p')`
  font-size: 16px;
  font-weight: 600;
`;

let BottomRow = styled('p')`
  margin-top: 40px;
  font-size: 14px;
  opacity: 0.5;
`;

let Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 40px;

  @media screen and (max-width: 800px) {
    gap: 25px;
  }
`;

let Column = styled('div')`
  h1 {
    font-size: 18px;
    font-weight: 600;
  }

  ul {
    li {
      margin-top: 15px;

      a {
        font-size: 14px;
        color: #777;
        transition: all 0.3s ease;
      }

      @media screen and (max-width: 800px) {
        margin-top: 5px;
      }
    }
  }
`;

export let Footer = () => {
  return (
    <Wrapper>
      <div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 40, alignItems: 'center' }}>
          <Logo size={30} />
          <TopRow>Metorial</TopRow>
        </div>

        <Grid>
          <Column>
            <h1>Product</h1>
            <ul>
              <li>
                <a href="/pricing">Pricing</a>
              </li>
              <li>
                <a href="/changelog">Changelog</a>
              </li>
              <li>
                <a href="/docs">Docs</a>
              </li>
              <li>
                <a href="/api">API</a>
              </li>
            </ul>
          </Column>

          <Column>
            <h1>Legal</h1>
            <ul>
              <li>
                <a href="/legal/terms-of-service">Terms of Service</a>
              </li>
              <li>
                <a href="/legal/privacy-policy">Privacy Policy</a>
              </li>
              <li>
                <a href="/legal/refund-and-payment-policy">Payments and Refunds</a>
              </li>
              <li>
                <a href="/legal/imprint">Imprint</a>
              </li>
            </ul>
          </Column>

          <Column>
            <h1>Tools</h1>
            <ul>
              <li>
                <a href="/websocket-explorer">Websocket Explorer</a>
              </li>
            </ul>
          </Column>

          <Column>
            <h1>Socials</h1>
            <ul>
              <li>
                <a href="/blog">Blog</a>
              </li>
              <li>
                <a href="https://x.com/metorial_ai">X</a>
              </li>
              <li>
                <a href="https://github.com/metorial">Github</a>
              </li>
              <li>
                <a href="/support">Support</a>
              </li>
            </ul>
          </Column>
        </Grid>

        <BottomRow>© {new Date().getFullYear()} Metorial. All rights reserved.</BottomRow>
      </div>
    </Wrapper>
  );
};
