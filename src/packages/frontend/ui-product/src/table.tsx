import { theme } from '@metorial/ui';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';

let TableWrapper = styled.table`
  border-collapse: collapse;
  width: 100%;
`;

let TableHead = styled.thead`
  font-size: 14px;
  font-weight: 500;
  text-align: left;
`;

let TableBody = styled.tbody`
  font-size: 14px;
  padding: 0px;
`;

let TableRow = styled.tr`
  text-align: left;

  &:not(:last-child) {
    & > td {
      border-bottom: 1px solid ${theme.colors.gray300};
    }
  }
`;

let TableCell = styled.td`
  text-align: left;

  & > a {
    text-decoration: none;
    color: unset;
  }

  & > button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: inherit;
    font: inherit;
    width: 100%;
  }
`;

let TableHeader = styled.th`
  border-bottom: 1px solid ${theme.colors.gray300};
  text-align: left;
`;

let Wrapper = styled.div`
  overflow-x: auto;
  position: relative;
`;

let CellInner = styled.div`
  min-height: 30px;
  display: flex;
  align-items: center;
`;

export let Table = ({
  padding,
  headers,
  data
}: {
  headers: string[];
  padding?: { sides: string };
  data: (
    | React.ReactNode[]
    | { data: React.ReactNode[]; href?: string; onClick?: () => void }
  )[];
}) => {
  let normalizedData = useMemo(
    () => (data ?? []).map(row => (Array.isArray(row) ? { data: row } : row)),
    [data]
  );

  return (
    <Wrapper>
      <TableWrapper>
        <TableHead>
          <TableRow>
            {headers.map((header, i) => {
              let isFirst = i === 0;
              let isLast = i === headers.length - 1;

              return (
                <TableHeader key={`header-${i}`}>
                  <CellInner
                    style={{
                      paddingLeft: isFirst ? padding?.sides : 10,
                      paddingRight: isLast ? padding?.sides : 10
                    }}
                  >
                    {header}
                  </CellInner>
                </TableHeader>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {normalizedData.map((row, i) => (
            <TableRow key={`row-${i}`}>
              {row.data.map((cell, j) => {
                let isFirst = j === 0;
                let isLast = j === row.data.length - 1;

                let inner = (
                  <CellInner
                    style={{
                      paddingLeft: isFirst ? padding?.sides : 10,
                      paddingRight: isLast ? padding?.sides : 10
                    }}
                  >
                    {cell}
                  </CellInner>
                );

                if (row.href) {
                  inner = <Link to={row.href}>{inner}</Link>;
                }

                if (row.onClick) {
                  inner = <button onClick={row.onClick}>{inner}</button>;
                }

                return <TableCell key={`cell-${i}-${j}`}>{inner}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </TableWrapper>
    </Wrapper>
  );
};
