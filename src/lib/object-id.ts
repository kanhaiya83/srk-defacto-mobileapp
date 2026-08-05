/**
 * Client-side ObjectId.
 *
 * GRN line items are addressed by `_id` before they ever reach the server, so
 * the form can key rows and detect duplicates while editing. The web client
 * uses `bson`; this generates the same 24-hex shape (4-byte timestamp, 5-byte
 * random, 3-byte counter) without pulling a Node-oriented dependency into the
 * bundle.
 */

const RANDOM = Array.from({ length: 5 }, () => Math.floor(Math.random() * 256));
let counter = Math.floor(Math.random() * 0xffffff);

const hex = (value: number, length: number) => value.toString(16).padStart(length, '0');

export function objectId(): string {
  counter = (counter + 1) % 0xffffff;
  const timestamp = Math.floor(Date.now() / 1000);
  return (
    hex(timestamp, 8) +
    RANDOM.map((byte) => hex(byte, 2)).join('') +
    hex(counter, 6)
  );
}
