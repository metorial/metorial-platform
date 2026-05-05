import { useMemo } from 'react';
import styled from 'styled-components';

let Iframe = styled.iframe`
  width: 100%;
  height: 800px;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #555;
`;

export let CodeViewer = ({
  repo,
  owner,
  path,
  title,
  initialFile,
  replacements
}: {
  repo: string;
  owner: string;
  path: string;
  title?: string;
  initialFile?: string;
  replacements?: Record<string, string | undefined>;
}) => {
  let url = useMemo(() => {
    let url = new URL('https://code-viewer.metorial.com');
    url.searchParams.set('repo', repo);
    url.searchParams.set('owner', owner);
    url.searchParams.set('path', path);
    return url.toString();
  }, [repo, owner, path, title]);

  return <Iframe src={url} title={title || 'Code Viewer'} />;
};
