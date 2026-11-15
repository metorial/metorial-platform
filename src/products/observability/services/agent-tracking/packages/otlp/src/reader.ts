import { OtlpDecodeError } from './model';

let utf8 = new TextDecoder('utf-8', { fatal: false });

export class Reader {
  pos: number;
  field = 0;
  wire = 0;

  private view: DataView;

  constructor(
    private buf: Uint8Array,
    start = 0,
    private end = buf.length
  ) {
    this.pos = start;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  next(): boolean {
    if (this.pos >= this.end) return false;

    let tag = this.varint32();

    this.field = tag >>> 3;
    this.wire = tag & 7;

    if (this.field == 0) throw new OtlpDecodeError('invalid field number');

    return true;
  }

  varint32(): number {
    let result = 0;

    for (let shift = 0; shift < 35; shift += 7) {
      if (this.pos >= this.end) throw new OtlpDecodeError('truncated varint');

      let byte = this.buf[this.pos++]!;
      result |= (byte & 0x7f) << shift;

      if ((byte & 0x80) == 0) return result >>> 0;
    }

    throw new OtlpDecodeError('varint too long');
  }

  varintBig(): bigint {
    let result = 0n;

    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (this.pos >= this.end) throw new OtlpDecodeError('truncated varint');

      let byte = this.buf[this.pos++]!;
      result |= BigInt(byte & 0x7f) << shift;

      if ((byte & 0x80) == 0) return BigInt.asUintN(64, result);
    }

    throw new OtlpDecodeError('varint too long');
  }

  varintNumber(): number {
    let value = this.varintBig();

    return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
  }

  fixed64(): bigint {
    this.need(8);

    let value = this.view.getBigUint64(this.pos, true);
    this.pos += 8;

    return value;
  }

  fixed32(): number {
    this.need(4);

    let value = this.view.getUint32(this.pos, true);
    this.pos += 4;

    return value;
  }

  double(): number {
    this.need(8);

    let value = this.view.getFloat64(this.pos, true);
    this.pos += 8;

    return value;
  }

  length(): number {
    let length = this.varint32();

    if (length > this.end - this.pos) throw new OtlpDecodeError('length exceeds message');

    return length;
  }

  bytes(): Uint8Array {
    let length = this.length();
    let slice = this.buf.subarray(this.pos, this.pos + length);

    this.pos += length;

    return slice;
  }

  string(): string {
    return utf8.decode(this.bytes());
  }

  message(): Reader {
    let length = this.length();
    let reader = new Reader(this.buf, this.pos, this.pos + length);

    this.pos += length;

    return reader;
  }

  expect(wire: number) {
    if (this.wire != wire) throw new OtlpDecodeError('unexpected wire type');
  }

  skip() {
    switch (this.wire) {
      case 0:
        this.varintBig();
        return;
      case 1:
        this.need(8);
        this.pos += 8;
        return;
      case 2: {
        let length = this.length();
        this.pos += length;
        return;
      }
      case 5:
        this.need(4);
        this.pos += 4;
        return;
      default:
        throw new OtlpDecodeError('unsupported wire type');
    }
  }

  private need(count: number) {
    if (count > this.end - this.pos) throw new OtlpDecodeError('truncated field');
  }
}
