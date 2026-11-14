type Num = bigint | number;

interface SnowflakeGeneratorOptions {
  workerId: Num;
  datacenterId: Num;
  epoch?: Date;
  workerIdBits?: Num;
  datacenterIdBits?: Num;
  initialSequence?: Num;
  sequenceBits?: Num;
}

export class Snowflake {
  private customEpoch: bigint;
  private workerIdBitLength: bigint;
  private datacenterIdBitLength: bigint;
  private sequenceBitLength: bigint;

  private workerId: bigint;
  private datacenterId: bigint;

  private maxWorkerId: bigint;
  private maxDatacenterId: bigint;

  private currentSequence: bigint;
  private sequenceBitmask: bigint;
  private lastGeneratedTimestamp: bigint = -1n;

  private workerIdBitShift: bigint;
  private datacenterIdBitShift: bigint;
  private timestampBitShift: bigint;

  constructor(options?: SnowflakeGeneratorOptions) {
    this.customEpoch = BigInt(options?.epoch ? options.epoch.getTime() : 1609459200000);

    this.workerIdBitLength = BigInt(options?.workerIdBits ?? 5);
    this.datacenterIdBitLength = BigInt(options?.datacenterIdBits ?? 5);
    this.sequenceBitLength = BigInt(options?.sequenceBits ?? 12);

    this.maxWorkerId = this.calculateMaxValue(this.workerIdBitLength);
    this.maxDatacenterId = this.calculateMaxValue(this.datacenterIdBitLength);
    this.sequenceBitmask = this.calculateMaxValue(this.sequenceBitLength);

    this.workerId = BigInt(options?.workerId ?? 0n);
    this.validateId(this.workerId, this.maxWorkerId, 'worker', this.workerIdBitLength);

    this.datacenterId = BigInt(options?.datacenterId ?? 0n);
    this.validateId(
      this.datacenterId,
      this.maxDatacenterId,
      'datacenter',
      this.datacenterIdBitLength
    );

    this.currentSequence = BigInt(options?.initialSequence ?? 0);

    this.workerIdBitShift = this.sequenceBitLength;
    this.datacenterIdBitShift = this.sequenceBitLength + this.workerIdBitLength;
    this.timestampBitShift =
      this.sequenceBitLength + this.workerIdBitLength + this.datacenterIdBitLength;
  }

  nextId(): bigint {
    let currentTimestamp = Snowflake.now();

    this.validateTimestamp(currentTimestamp);

    if (this.isWithinSameMillisecond(currentTimestamp)) {
      this.incrementSequence();

      if (this.hasSequenceOverflowed()) {
        currentTimestamp = this.waitForNextMillisecond(this.lastGeneratedTimestamp);
      }
    } else {
      this.resetSequence();
    }

    this.lastGeneratedTimestamp = currentTimestamp;

    return this.composeSnowflakeId(currentTimestamp);
  }

  private calculateMaxValue(bitLength: bigint): bigint {
    return -1n ^ (-1n << bitLength);
  }

  private validateId(id: bigint, maxId: bigint, idType: string, bitLength: bigint): void {
    if (id < 0 || id > maxId) {
      throw new Error(`With ${bitLength} bits, ${idType} id must be between 0 and ${maxId}`);
    }
  }

  private validateTimestamp(currentTimestamp: bigint): void {
    if (currentTimestamp < this.lastGeneratedTimestamp) {
      let timeDrift = this.lastGeneratedTimestamp - currentTimestamp;
      throw new Error(
        `Clock moved backwards. Cannot generate new ID for ${timeDrift} milliseconds.`
      );
    }
  }

  private isWithinSameMillisecond(timestamp: bigint): boolean {
    return timestamp === this.lastGeneratedTimestamp;
  }

  private incrementSequence(): void {
    this.currentSequence = (this.currentSequence + 1n) & this.sequenceBitmask;
  }

  private hasSequenceOverflowed(): boolean {
    return this.currentSequence === 0n;
  }

  private resetSequence(): void {
    this.currentSequence = 0n;
  }

  private waitForNextMillisecond(lastTimestamp: bigint): bigint {
    let timestamp: bigint;

    do {
      timestamp = Snowflake.now();
    } while (timestamp <= lastTimestamp);

    return timestamp;
  }

  private composeSnowflakeId(timestamp: bigint): bigint {
    let timestampComponent = (timestamp - this.customEpoch) << this.timestampBitShift;
    let datacenterComponent = this.datacenterId << this.datacenterIdBitShift;
    let workerComponent = this.workerId << this.workerIdBitShift;
    let sequenceComponent = this.currentSequence;

    return timestampComponent | datacenterComponent | workerComponent | sequenceComponent;
  }

  static now(): bigint {
    return BigInt(Date.now());
  }
}
