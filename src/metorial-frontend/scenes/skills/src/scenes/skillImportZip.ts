let maxSkillImportZipBytes = 10 * 1024 * 1024;
let ignoredFileNames = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
let ignoredDirectoryNames = new Set(['.git', 'node_modules', '__macosx']);

let crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crcTable[i] = crc >>> 0;
}

let crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) {
    crc = crcTable[(crc ^ data[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

let concatBytes = (parts: Uint8Array[]) => {
  let output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (let part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
};

let u16 = (value: number) => {
  let bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
};

let u32 = (value: number) => {
  let bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};

let toDosDateTime = (date: Date) => {
  let year = Math.max(date.getFullYear(), 1980);
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
};

export let getSkillImportZipPath = (
  file: Pick<File, 'name'> & { webkitRelativePath?: string }
) => {
  let relativePath = (file.webkitRelativePath || file.name)
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');
  let segments = relativePath.split('/').filter(Boolean);
  if (!segments.length || segments.some(segment => segment == '.' || segment == '..')) {
    return null;
  }

  let hasIgnoredDirectory = segments
    .slice(0, -1)
    .some(segment => ignoredDirectoryNames.has(segment.toLowerCase()));
  let fileName = segments.at(-1)!.toLowerCase();
  if (
    hasIgnoredDirectory ||
    ignoredDirectoryNames.has(fileName) ||
    ignoredFileNames.has(fileName)
  ) {
    return null;
  }

  return segments.join('/');
};

export let validateSkillImportDirectory = (
  files: Array<Pick<File, 'name' | 'size'> & { webkitRelativePath?: string }>
) => {
  let selected = files.filter(file => getSkillImportZipPath(file));
  if (!selected.length) return 'Choose a folder that contains at least one file.';

  let totalBytes = selected.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxSkillImportZipBytes) {
    return 'ZIP skill archives must be 10 MB or smaller.';
  }

  return null;
};

let getSkillImportZipName = (paths: string[]) => {
  let root = paths[0]?.split('/')[0];
  if (root && paths.every(path => path == root || path.startsWith(`${root}/`))) {
    return root.toLowerCase().endsWith('.zip') ? root : `${root}.zip`;
  }

  return 'skills.zip';
};

export let createStoredZipArchive = (
  entries: { path: string; data: Uint8Array; modifiedAt?: Date }[]
) => {
  let localParts: Uint8Array[] = [];
  let centralParts: Uint8Array[] = [];
  let offset = 0;
  let encoder = new TextEncoder();

  for (let entry of entries) {
    let nameBytes = encoder.encode(entry.path);
    let { time, date } = toDosDateTime(entry.modifiedAt ?? new Date());
    let checksum = crc32(entry.data);
    let localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(date),
      u32(checksum),
      u32(entry.data.byteLength),
      u32(entry.data.byteLength),
      u16(nameBytes.byteLength),
      u16(0),
      nameBytes
    ]);

    localParts.push(localHeader, entry.data);
    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(checksum),
        u32(entry.data.byteLength),
        u32(entry.data.byteLength),
        u16(nameBytes.byteLength),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes
      ])
    );
    offset += localHeader.byteLength + entry.data.byteLength;
  }

  let centralDirectory = concatBytes(centralParts);
  return concatBytes([
    ...localParts,
    centralDirectory,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.byteLength),
    u32(offset),
    u16(0)
  ]);
};

export let createSkillImportZipFromDirectory = async (files: File[]) => {
  let validationError = validateSkillImportDirectory(files);
  if (validationError) throw new Error(validationError);

  let entries: { path: string; data: Uint8Array; modifiedAt: Date }[] = [];
  for (let file of files) {
    let path = getSkillImportZipPath(file);
    if (!path) continue;

    entries.push({
      path,
      data: new Uint8Array(await file.arrayBuffer()),
      modifiedAt: new Date(file.lastModified)
    });
  }

  let zipBytes = createStoredZipArchive(entries);
  if (zipBytes.byteLength > maxSkillImportZipBytes) {
    throw new Error('ZIP skill archives must be 10 MB or smaller.');
  }

  return new File([zipBytes], getSkillImportZipName(entries.map(entry => entry.path)), {
    type: 'application/zip'
  });
};
