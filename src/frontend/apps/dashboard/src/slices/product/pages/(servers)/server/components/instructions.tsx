import { CodeBlock } from '@metorial/code';
import { AnimatePanes, Control, Spacer, theme } from '@metorial/ui';
import React, { useState } from 'react';
import styled from 'styled-components';
import { CodeViewer } from './codeViewer';

export type InstructionItemOption =
  | { type: 'code'; lineNumbers?: boolean; code: string; language?: string }
  | {
      component: React.ReactNode;
    };

export type InstructionItem = {
  title: React.ReactNode;
  description: React.ReactNode;
} & (
  | InstructionItemOption
  | {
      variants: {
        label: string;
        item: InstructionItemOption;
      }[];
    }
);

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

let Items = styled.ul`
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: 0;
  margin: 0;
`;

let Item = styled.li`
  padding: 40px 0px;
  display: grid;
  gap: 30px;
  grid-template-columns: calc(45% - 30px) 55%;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray400};
  }
`;

let ItemMain = styled.main`
  display: flex;
  flex-direction: column;
  gap: 5px;

  h3 {
    font-size: 16px;
    font-weight: 600;
  }

  p {
    font-size: 14px;
    color: ${theme.colors.gray600};
    font-weight: 500;
  }
`;

let ItemAside = styled.aside``;

let Variants = styled.div`
  display: grid;
  gap: 20px;
  margin-bottom: 20px;
  overflow-x: auto;
`;

let Variant = styled.button`
  padding: 20px 30px;
  border: none;
  border-radius: 12px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease-in-out;

  &[data-active='true'] {
    background: ${theme.colors.gray400};
    color: ${theme.colors.black100};
  }

  p {
    font-size: 12px;
    font-weight: 500;
  }

  svg,
  img {
    height: 24px;
    width: 24px;
  }
`;

let InstructionItem = ({ item }: { item: InstructionItem }) => {
  let [variant, setVariant] = useState(0);
  let options = 'variants' in item ? item.variants : [{ label: 'Default', item }];
  let currentOption = options[variant];

  return (
    <Item>
      <ItemMain>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </ItemMain>

      <ItemAside>
        {options.length > 1 && (
          <>
            <Control
              items={options.map((option, i) => ({
                id: String(i),
                label: option.label
              }))}
              onChange={id => setVariant(Number(id))}
              value={String(variant)}
            />

            <Spacer height={10} />
          </>
        )}

        {'type' in currentOption.item && currentOption.item.type === 'code' && (
          <CodeBlock
            language={currentOption.item.language}
            code={currentOption.item.code}
            lineNumbers={!!currentOption.item.lineNumbers}
          />
        )}

        {'component' in currentOption.item && currentOption.item.component}
      </ItemAside>
    </Item>
  );
};

export let Instructions = ({
  variants
}: {
  variants: {
    instructions: InstructionItem[];
    title: string;
    icon: React.ReactNode;

    codeViewer?: {
      repo: string;
      owner: string;
      path: string;
      title?: string;
      initialFile?: string;
    };
  }[];
}) => {
  let [variant, setVariant] = useState(0);
  let currentVariant = variants[variant];

  return (
    <Wrapper>
      <Variants
        style={{
          gridTemplateColumns: new Array(variants.length).fill('minmax(120px, 1fr)').join(' ')
        }}
      >
        {variants.map((v, index) => (
          <Variant
            key={index}
            data-active={variant === index}
            onClick={() => setVariant(index)}
          >
            {v.icon}

            <p>{v.title}</p>
          </Variant>
        ))}
      </Variants>

      <AnimatePanes orderedIdentifier={variant}>
        <Items>
          {currentVariant.instructions.map((item, index) => (
            <InstructionItem key={index} item={item} />
          ))}
        </Items>

        {currentVariant.codeViewer && (
          <CodeViewer {...currentVariant.codeViewer} title={currentVariant.title} />
        )}
      </AnimatePanes>
    </Wrapper>
  );
};
