import { describe, expect, it } from 'vitest';
import { classifyHead } from './skillFiles';

let bytes = (...values: number[]) => Uint8Array.from(values);
let text = (value: string) => new TextEncoder().encode(value);

describe('classifyHead', () => {
  it('classifies plain text', () => {
    let result = classifyHead({ head: text('# Skill\n\nHello'), fileName: 'SKILL.md' });
    expect(result.kind).toBe('text');
    expect(result.isDisguised).toBe(false);
  });

  it('keeps text that merely starts with MZ as text', () => {
    let result = classifyHead({ head: text('MZ was here'), fileName: 'notes.txt' });
    expect(result.kind).toBe('text');
  });

  it('treats a real PNG as an image without a finding', () => {
    let result = classifyHead({
      head: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13),
      fileName: 'logo.png'
    });
    expect(result).toMatchObject({
      kind: 'image',
      detectedMime: 'image/png',
      isDisguised: false
    });
  });

  it('flags an ELF binary named .png as disguised', () => {
    let result = classifyHead({
      head: bytes(0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0),
      fileName: 'logo.png'
    });
    expect(result).toMatchObject({ kind: 'executable', isDisguised: true });
  });

  it('flags a zip named .pdf as disguised', () => {
    let result = classifyHead({
      head: bytes(0x50, 0x4b, 3, 4, 0, 0, 0, 0),
      fileName: 'manual.pdf'
    });
    expect(result).toMatchObject({ kind: 'archive', isDisguised: true });
  });

  it('does not flag a zip named .docx', () => {
    let result = classifyHead({
      head: bytes(0x50, 0x4b, 3, 4, 0, 0, 0, 0),
      fileName: 'a.docx'
    });
    expect(result).toMatchObject({ kind: 'archive', isDisguised: false });
  });

  it('detects Python bytecode', () => {
    let result = classifyHead({
      head: bytes(0xa7, 0x0d, 0x0d, 0x0a, 0, 0, 0, 0),
      fileName: 'helper.pyc'
    });
    expect(result.kind).toBe('executable');
  });

  it('separates Java classes from universal Mach-O binaries', () => {
    let java = classifyHead({
      head: bytes(0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 65),
      fileName: 'A.class'
    });
    let fat = classifyHead({
      head: bytes(0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 2),
      fileName: 'tool'
    });
    expect(java.detectedMime).toBe('application/java-vm');
    expect(fat.detectedMime).toBe('application/x-mach-binary');
  });

  it('detects tar by the signature at offset 257', () => {
    let head = new Uint8Array(512);
    head.set(text('ustar'), 257);
    expect(classifyHead({ head, fileName: 'bundle.dat' }).kind).toBe('archive');
  });

  it('treats unknown binary data as unknown_binary and empty data as empty', () => {
    expect(classifyHead({ head: bytes(1, 2, 3, 0, 5), fileName: 'blob' }).kind).toBe(
      'unknown_binary'
    );
    expect(classifyHead({ head: new Uint8Array(), fileName: 'empty.txt' }).kind).toBe('empty');
  });

  it('accepts a multibyte character cut off at the end of the head', () => {
    let full = text('héllo wörld ✓');
    let result = classifyHead({ head: full.subarray(0, full.length - 1), fileName: 'a.txt' });
    expect(result.kind).toBe('text');
  });
});
