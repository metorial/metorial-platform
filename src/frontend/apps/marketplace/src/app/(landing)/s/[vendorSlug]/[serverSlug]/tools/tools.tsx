'use client';

import styled from 'styled-components';
import { ServerListing } from '../../../../../../state/server';
import { useExplorer } from '../components/explorer/context';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let Tools = ({ server }: { server: ServerListing }) => {
  let explorer = useExplorer(server);

  return null;

  // let tools = server.current_version?.tools ?? [];

  // return (
  //   <Wrapper>
  //     {tools.length === 0 && <Text>This server has no tools available.</Text>}

  //     {tools.map((tool, i) => (
  //       <Entity.Wrapper key={i}>
  //         <Entity.Content>
  //           <Entity.Field
  //             title={Cases.toTitleCase(tool.name)}
  //             description={tool.description}
  //           />
  //         </Entity.Content>

  //         <Entity.Footer>
  //           <div
  //             style={{
  //               display: 'flex',
  //               gap: '10px',
  //               alignItems: 'center',
  //               justifyContent: 'space-between',
  //               width: '100%',
  //               flexGrow: 1
  //             }}
  //           >
  //             <Button
  //               size="1"
  //               variant="outline"
  //               onClick={() => {
  //                 explorer.open();
  //               }}
  //             >
  //               Open in Explorer
  //             </Button>

  //             <Text size="1" color="gray600">
  //               {tool.name}
  //             </Text>
  //           </div>
  //         </Entity.Footer>
  //       </Entity.Wrapper>
  //     ))}
  //   </Wrapper>
  // );
};
