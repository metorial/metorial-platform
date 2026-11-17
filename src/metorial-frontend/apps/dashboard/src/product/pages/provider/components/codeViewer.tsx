import { checkEdition } from '@metorial/editions';
import { Button } from '@metorial/ui';
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

type CodeViewerProps = {
  repo: string;
  owner: string;
  path: string;
  title?: string;
  initialFile?: string;
  replacements?: Record<string, string | undefined>;
};

let CloudCodeViewer = ({
  repo,
  owner,
  path,
  title,
  initialFile,
  replacements
}: CodeViewerProps) => {
  let url = useMemo(() => {
    let url = new URL('https://code-viewer.metorial.com');
    url.searchParams.set('repo', repo);
    url.searchParams.set('owner', owner);
    url.searchParams.set('path', path);
    if (title) url.searchParams.set('title', title);
    if (initialFile) url.searchParams.set('initial_file', initialFile);
    if (replacements) {
      let final: Record<string, string> = {};
      for (let [key, value] of Object.entries(replacements)) {
        if (value) final[key] = value;
      }
      url.searchParams.set('replacements', btoa(JSON.stringify(final)));
    }

    return url.toString();
  }, [repo, owner, path, title]);

  return <Iframe src={url} title={title || 'Code Viewer'} />;
};

export let CodeViewer = (props: CodeViewerProps) => {
  let { owner, repo, path } = props;

  if (checkEdition('on-prem')) {
    return (
      <a
        href={`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree/HEAD/${path.split('/').map(encodeURIComponent).join('/')}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button as="span" variant="outline">
          View Source on GitHub
        </Button>
      </a>
    );
  }

  return <CloudCodeViewer {...props} />;
};
