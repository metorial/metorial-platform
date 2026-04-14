import JSZip from 'jszip';

export let createZipFromFiles = async (
  files: {
    filename: string;
    content: string;
    encoding?: 'utf-8' | 'base64';
  }[]
) => {
  let zip = new JSZip();

  for (let file of files) {
    if (file.encoding === 'base64') {
      zip.file(file.filename, file.content, { base64: true });
    } else {
      zip.file(file.filename, file.content);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
};
