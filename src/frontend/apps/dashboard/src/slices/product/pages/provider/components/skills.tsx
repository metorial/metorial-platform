import { AnimateHeight, Button, InfoTooltip, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  padding: 20px;
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

let MotionItem = motion(Item);

let Actions = styled.div`
  margin-top: 14px;
`;

let DEFAULT_VISIBLE_SKILLS = 3;

export let Skills = ({ skills }: { skills: string[] }) => {
  let [showAll, setShowAll] = useState(false);

  if (skills.length === 0) return null;

  let visibleSkills = skills.slice(0, DEFAULT_VISIBLE_SKILLS);
  let hiddenSkills = skills.slice(DEFAULT_VISIBLE_SKILLS);

  return (
    <Wrapper>
      <Header>
        <Title>Provider Summary</Title>

        <InfoTooltip>
          An AI generated overview of the provider's capabilities and features.
        </InfoTooltip>
      </Header>

      <AnimateHeight>
        <>
          <List>
            {visibleSkills.map((skill, index) => (
              <Item key={index}>
                <RiCheckLine />
                <p>{skill}</p>
              </Item>
            ))}

            {showAll &&
              hiddenSkills.map((skill, index) => (
                <MotionItem
                  key={`${index + DEFAULT_VISIBLE_SKILLS}-${skill}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    ease: 'easeOut',
                    delay: index * 0.06
                  }}
                >
                  <RiCheckLine />
                  <p>{skill}</p>
                </MotionItem>
              ))}
          </List>

          {!showAll && hiddenSkills.length > 0 && (
            <Actions>
              <Button type="button" size="1" variant="outline" onClick={() => setShowAll(true)}>
                Show more
              </Button>
            </Actions>
          )}
        </>
      </AnimateHeight>
    </Wrapper>
  );
};
