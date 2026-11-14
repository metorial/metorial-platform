import fs from 'fs/promises';
import JSZip from 'jszip';

export let createZipFromFiles = (
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

  return zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
};

export let createZipFromDirectory = async (directoryPath: string) => {
  let zip = new JSZip();

  let addFilesRecursively = async (folderPath: string, zipFolder: JSZip) => {
    let entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (let entry of entries) {
      let fullPath = `${folderPath}/${entry.name}`;
      if (entry.isDirectory()) {
        let newZipFolder = zipFolder.folder(entry.name);
        if (newZipFolder) {
          await addFilesRecursively(fullPath, newZipFolder);
        }
      } else if (entry.isFile()) {
        let fileContent = await fs.readFile(fullPath);
        zipFolder.file(entry.name, fileContent);
      }
    }
  };

  await addFilesRecursively(directoryPath, zip);

  return zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
};
