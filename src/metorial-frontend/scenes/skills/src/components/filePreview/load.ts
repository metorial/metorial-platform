import { useEffect, useMemo, useState } from 'react';

export let usePreviewObjectUrl = (downloadUrl: string | null | undefined) => {
  let [objectUrl, setObjectUrl] = useState<string | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!downloadUrl) return;

    let cancelled = false;
    let createdObjectUrl: string | null = null;

    setObjectUrl(null);
    setError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return await response.blob();
      })
      .then(blob => {
        if (cancelled) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(createdObjectUrl);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
      });

    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [downloadUrl]);

  return { objectUrl, error };
};

export let usePreviewArrayBuffer = (downloadUrl: string | null | undefined) => {
  let [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!downloadUrl) return;

    let cancelled = false;

    setArrayBuffer(null);
    setError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return await response.arrayBuffer();
      })
      .then(buffer => {
        if (!cancelled) setArrayBuffer(buffer);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
      });

    return () => {
      cancelled = true;
    };
  }, [downloadUrl]);

  return { arrayBuffer, error };
};

export let useDownloadHref = (downloadUrl: string | null | undefined) =>
  useMemo(() => {
    if (!downloadUrl) return null;
    try {
      let url = new URL(downloadUrl);
      url.searchParams.set('download', '1');
      return url.toString();
    } catch {
      return downloadUrl;
    }
  }, [downloadUrl]);
