import { inflateRawSync } from 'node:zlib';

export type ZipArchiveEntry = { path: string; method: number; crc32: number; data: Buffer };

let endOfCentralDirectory = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
let centralDirectoryHeader = 0x02014b50;
let localFileHeader = 0x04034b50;

// Enough of APPNOTE to read the small archives the e2e suite produces; ZIP64 is rejected.
export let readZipArchive = (archive: Buffer): ZipArchiveEntry[] => {
  let end = archive.lastIndexOf(endOfCentralDirectory);
  if (end < 0) throw new Error('Archive has no end of central directory record');

  let entryCount = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  if (entryCount === 0xffff || offset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported by the test reader');
  }

  let entries: ZipArchiveEntry[] = [];
  for (let index = 0; index < entryCount; index++) {
    if (archive.readUInt32LE(offset) !== centralDirectoryHeader) {
      throw new Error(`Bad central directory header at ${offset}`);
    }

    let method = archive.readUInt16LE(offset + 10);
    let crc32 = archive.readUInt32LE(offset + 16);
    let compressedSize = archive.readUInt32LE(offset + 20);
    let nameLength = archive.readUInt16LE(offset + 28);
    let extraLength = archive.readUInt16LE(offset + 30);
    let commentLength = archive.readUInt16LE(offset + 32);
    let localOffset = archive.readUInt32LE(offset + 42);
    let path = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');

    if (archive.readUInt32LE(localOffset) !== localFileHeader) {
      throw new Error(`Bad local file header for ${path}`);
    }

    let dataStart =
      localOffset +
      30 +
      archive.readUInt16LE(localOffset + 26) +
      archive.readUInt16LE(localOffset + 28);
    let raw = archive.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`Unsupported compression method ${method} for ${path}`);

    entries.push({ path, method, crc32, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};
