// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

/** @ignore */
export function getBool(_data: any, _index: number, byte: number, bit: number) {
    return (byte & 1 << bit) !== 0;
}

/** @ignore */
export function getBit(_data: any, _index: number, byte: number, bit: number): 0 | 1 {
    return (byte & 1 << bit) >> bit as (0 | 1);
}

/** @ignore */
export function setBool(bytes: Uint8Array, index: number, value: any) {
    return value ?
        !!(bytes[index >> 3] |=  (1 << (index % 8))) || true :
        !(bytes[index >> 3] &= ~(1 << (index % 8))) && false ;
}

/** @ignore */
export function truncateBitmap(offset: number, length: number, bitmap: Uint8Array) {
    const alignedSize = (bitmap.byteLength + 7) & ~7;
    if (offset > 0 || bitmap.byteLength < alignedSize) {
        const bytes = new Uint8Array(alignedSize);
        // If the offset is a multiple of 8 bits, it's safe to slice the bitmap
        bytes.set(offset % 8 === 0 ? bitmap.subarray(offset >> 3) :
            // Otherwise iterate each bit from the offset and return a new one
            packBools(new BitIterator(bitmap, offset, length, null, getBool)).subarray(0, alignedSize));
        return bytes;
    }
    return bitmap;
}

/** @ignore */
export function packBools(values: Iterable<any>) {
    let xs: number[] = [];
    let i = 0, bit = 0, byte = 0;
    for (const value of values) {
        value && (byte |= 1 << bit);
        if (++bit === 8) {
            xs[i++] = byte;
            byte = bit = 0;
        }
    }
    if (i === 0 || bit > 0) { xs[i++] = byte; }
    let b = new Uint8Array((xs.length + 7) & ~7);
    b.set(xs);
    return b;
}

/** @ignore */
export class BitIterator<T> implements IterableIterator<T> {
    bit: number;
    byte: number;
    byteIndex: number;
    index: number;

    constructor(
        private bytes: Uint8Array,
        begin: number,
        private length: number,
        private context: any,
        private get: (context: any, index: number, byte: number, bit: number) => T
    ) {
        this.bit = begin % 8;
        this.byteIndex = begin >> 3;
        this.byte = bytes[this.byteIndex++];
        this.index = 0;
    }

    next(): IteratorResult<T> {
        if (this.index < this.length) {
            if (this.bit === 8) {
                this.bit = 0;
                this.byte = this.bytes[this.byteIndex++];
            }
            return {
                value: this.get(this.context, this.index++, this.byte, this.bit++)
            };
        }
        return { done: true, value: null };
    }

    [Symbol.iterator]() {
        return this;
    }
}

/**
 * Compute the population count (the number of bits set to 1) for a range of bits in a Uint8Array.
 * @param vector The Uint8Array of bits for which to compute the population count.
 * @param lhs The range's left-hand side (or start) bit
 * @param rhs The range's right-hand side (or end) bit
 */
/** @ignore */
export function popcnt_bit_range(data: Uint8Array, lhs: number, rhs: number): number {
    if (rhs - lhs <= 0) { return 0; }
    // If the bit range is less than one byte, sum the 1 bits in the bit range
    if (rhs - lhs < 8) {
        let sum = 0;
        for (const bit of new BitIterator(data, lhs, rhs - lhs, data, getBit)) {
            sum += bit;
        }
        return sum;
    }
    // Get the next lowest multiple of 8 from the right hand side
    const rhsInside = rhs >> 3 << 3;
    // Get the next highest multiple of 8 from the left hand side
    const lhsInside = lhs + (lhs % 8 === 0 ? 0 : 8 - lhs % 8);
    return (
        // Get the popcnt of bits between the left hand side, and the next highest multiple of 8
        popcnt_bit_range(data, lhs, lhsInside) +
        // Get the popcnt of bits between the right hand side, and the next lowest multiple of 8
        popcnt_bit_range(data, rhsInside, rhs) +
        // Get the popcnt of all bits between the left and right hand sides' multiples of 8
        popcnt_array(data, lhsInside >> 3, (rhsInside - lhsInside) >> 3)
    );
}

/** @ignore */
export function popcnt_array(arr: ArrayBufferView, byteOffset?: number, byteLength?: number) {
    let cnt = 0, pos = byteOffset! | 0;
    const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    const len =  byteLength === void 0 ? arr.byteLength : pos + byteLength;
    while (len - pos >= 4) {
        cnt += popcnt_uint32(view.getUint32(pos));
        pos += 4;
    }
    while (len - pos >= 2) {
        cnt += popcnt_uint32(view.getUint16(pos));
        pos += 2;
    }
    while (len - pos >= 1) {
        cnt += popcnt_uint32(view.getUint8(pos));
        pos += 1;
    }
    return cnt;
}

/** @ignore */
export function popcnt_uint32(uint32: number): number {
    let i = uint32 | 0;
    i = i - ((i >>> 1) & 0x55555555);
    i = (i & 0x33333333) + ((i >>> 2) & 0x33333333);
    return (((i + (i >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}
