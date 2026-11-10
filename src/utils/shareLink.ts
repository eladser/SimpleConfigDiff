import { ConfigFormat, DiffOptions, PathRule, ValueTransformation } from '@/types';
import { formatNames } from '@/utils/parsers';

// Only options that change the diff go in the link. View state (diffMode, show secrets) stays local.
const FLAGS = ['caseSensitive', 'sortKeys', 'flattenKeys', 'semanticComparison', 'ignoreWhitespace', 'ignoreComments'] as const;

export type SharedOptions = Pick<DiffOptions, (typeof FLAGS)[number] | 'ignoreKeys' | 'pathRules' | 'valueTransformations'>;

export interface Shared {
  left: string;
  right: string;
  leftFormat: ConfigFormat | null;
  rightFormat: ConfigFormat | null;
  options: SharedOptions;
}

// Chat apps and mail clients start cutting links off somewhere past this
export const LONG_LINK = 100_000;

// An 80 KB link can inflate to 60 MB of text, so stop reading before a hostile link fills memory
const MAX_TEXT = 50_000_000;

function toBase64Url(bytes: Uint8Array) {
  let bin = '';
  // in chunks, spreading a big config at once overflows the call stack
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

const isStr = (v: unknown) => typeof v === 'string';
const optStr = (v: unknown) => v === undefined || typeof v === 'string';

function readFormat(f: unknown): ConfigFormat | null {
  if (f === null) return null;
  if (typeof f === 'string' && Object.hasOwn(formatNames, f)) return f as ConfigFormat;
  throw new Error('unknown format');
}

function readRule(r: any): PathRule {
  if (!isStr(r?.pattern) || !['regex', 'glob', 'exact'].includes(r.type) ||
      !['ignore', 'semantic', 'strict'].includes(r.action) || !optStr(r.description)) {
    throw new Error('bad path rule');
  }
  return { pattern: r.pattern, type: r.type, action: r.action, description: r.description };
}

function readTransform(t: any): ValueTransformation {
  if (!isStr(t?.name) || !isStr(t.pattern) || !isStr(t.replacement) ||
      typeof t.enabled !== 'boolean' || !optStr(t.description)) {
    throw new Error('bad value transformation');
  }
  return { name: t.name, pattern: t.pattern, replacement: t.replacement, enabled: t.enabled, description: t.description };
}

// Copies just the shared keys, and checks them, since a link can come from anyone
function pickOptions(o: any): SharedOptions {
  if (!o || typeof o !== 'object') throw new Error('missing options');
  for (const k of FLAGS) {
    if (typeof o[k] !== 'boolean') throw new Error(`bad option ${k}`);
  }
  if (!Array.isArray(o.ignoreKeys) || !o.ignoreKeys.every(isStr) ||
      !Array.isArray(o.pathRules) || !Array.isArray(o.valueTransformations)) {
    throw new Error('bad option lists');
  }
  return {
    caseSensitive: o.caseSensitive,
    sortKeys: o.sortKeys,
    flattenKeys: o.flattenKeys,
    semanticComparison: o.semanticComparison,
    ignoreWhitespace: o.ignoreWhitespace,
    ignoreComments: o.ignoreComments,
    ignoreKeys: [...o.ignoreKeys],
    pathRules: o.pathRules.map(readRule),
    valueTransformations: o.valueTransformations.map(readTransform),
  };
}

export async function encodeShare(s: Shared): Promise<string> {
  const json = JSON.stringify({
    left: s.left,
    right: s.right,
    leftFormat: s.leftFormat,
    rightFormat: s.rightFormat,
    options: pickOptions(s.options),
  });
  const packed = new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(new Uint8Array(await new Response(packed).arrayBuffer()));
}

// Throws on payloads that don't inflate to a valid share. deflate-raw has no checksum, so a small edit can still decode.
export async function decodeShare(d: string): Promise<Shared> {
  const reader = new Blob([fromBase64Url(d)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const dec = new TextDecoder('utf-8', { fatal: true });
  let json = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    json += dec.decode(value, { stream: true });
    if (json.length > MAX_TEXT) {
      await reader.cancel();
      throw new Error('payload too large');
    }
  }
  const p = JSON.parse(json + dec.decode());
  if (!isStr(p?.left) || !isStr(p.right)) throw new Error('missing configs');
  return {
    left: p.left,
    right: p.right,
    leftFormat: readFormat(p.leftFormat),
    rightFormat: readFormat(p.rightFormat),
    options: pickOptions(p.options),
  };
}
