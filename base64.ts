import { Buffer } from "buffer";

export function encodeB64(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64');
}

export function decodeB64(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8');
}
