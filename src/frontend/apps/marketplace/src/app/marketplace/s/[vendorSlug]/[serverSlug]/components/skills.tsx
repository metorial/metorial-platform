'use client';

import { InfoTooltip } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import styled from 'styled-components';

let Wrapper = styled.ul`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
`;

let Title = styled.p`
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

let List = styled.ul`
  margin: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Item = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;

  svg {
    height: 16px;
    width: 16px;
    color: #555;
  }

  p {
    font-size: 14px;
    color: #333;
    margin: 0;
    font-weight: 500;
  }
`;

export let Skills = ({ skills }: { skills: string[] }) => {
  if (skills.length === 0) return null;

  return (
    <Wrapper>
      <Header>
        <Title>Server Summary</Title>

        <InfoTooltip>
          An AI generated overview of the server's capabilities and features.
        </InfoTooltip>
      </Header>

      <List>
        {skills.map((skill, index) => (
          <Item key={index}>
            <RiCheckLine />
            <p>{skill}</p>
          </Item>
        ))}
      </List>
    </Wrapper>
  );
};
