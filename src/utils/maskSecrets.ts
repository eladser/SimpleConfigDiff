import { ComparisonResult, ConfigFile } from '@/types';

export const MASK = '••••••';

// A term counts when it ends a word, so dbPassword, AUTH_TOKEN, clientsecret
// and tokens[0] match while author, authority, secretary and tokenizer don't.
// bin/configdiff.js has a copy of this rule, keep the two in step.
const SECRET_KEY = /(password|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|credential|auth)s?(?![a-z])/g;
// A token next to one of these words is a count (max_tokens, tokenLimit)
const COUNT_WORDS = /^(max|min|num|total|count|limit|per|budget|usage|length|size)$/;

// Takes a key or a dotted path. A path is secret when any key on it is,
// which masks everything under a secret key too.
export function isSecretKey(key: string): boolean {
  return key.split('.').some(seg => {
    // a bare PWD is the shell's working directory
    if (seg.toLowerCase() === 'pwd') return false;
    const low = seg
      .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1\0$2')
      .toLowerCase();
    const counted = low.split(/[^a-z\d]+/).some(w => COUNT_WORDS.test(w));
    // Test the key up to each camelCase break with the breaks taken out, so a
    // term can run across one (PassWord) but still has to end a word
    const words = low.split('\0');
    return words.some((_, i) =>
      [...words.slice(0, i + 1).join('').matchAll(SECRET_KEY)].some(m => m[1] !== 'token' || !counted));
  });
}

// Only arrays and plain objects get walked, null-prototype ones too (INI
// sections, TOML tables). Dates and other class values pass through.
function walkable(v: any): boolean {
  if (v === null || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return Array.isArray(v) || p === Object.prototype || p === null;
}

export const hasSecrets = (value: any): boolean =>
  walkable(value) && Object.entries(value).some(([k, v]) => isSecretKey(k) || hasSecrets(v));

// Hands back the same value when nothing under it is secret
export function maskValue(value: any, key: string): any {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return MASK;
  if (!hasSecrets(value)) return value;
  if (Array.isArray(value)) return value.map(v => maskValue(v, ''));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskValue(v, k)]));
}

// Display copy of a result. The diff already ran on the real values, so change
// types and counts don't move. Returns the result itself when there's nothing to hide.
export function maskResult(result: ComparisonResult): ComparisonResult {
  const { leftFile: l, rightFile: r } = result;
  if (!hasSecrets(l.parsedContent) && !hasSecrets(r.parsedContent)) return result;

  // generateDiff lowercases top-level keys unless case-sensitive, so secretKey
  // arrives as secretkey and a dotted aws.secretKey key as aws.secretkey. The
  // rest get checked with the key as written, or maxTokens would read as the
  // one word maxtokens.
  const keys = [...Object.keys(l.parsedContent ?? {}), ...Object.keys(r.parsedContent ?? {})];
  const under = (path: string, t: string) => path === t || path.startsWith(t + '.') || path.startsWith(t + '[');
  const top = keys.filter(isSecretKey).map(k => k.toLowerCase());
  const written = (path: string) => {
    const k = keys.find(k => under(path, k.toLowerCase()));
    return k ? k + path.slice(k.length) : path;
  };
  const mask = (v: any, path: string) =>
    v != null && top.some(t => under(path, t)) ? MASK : maskValue(v, written(path));

  // Raw text can't be masked reliably, so it's dropped. That empties the raw
  // view and the patch context lines until secrets are shown.
  const file = (f: ConfigFile): ConfigFile => ({ ...f, content: '', parsedContent: maskValue(f.parsedContent, '') });

  return {
    ...result,
    changes: result.changes.map(c => ({ ...c, oldValue: mask(c.oldValue, c.path), newValue: mask(c.newValue, c.path) })),
    leftFile: file(l),
    rightFile: file(r),
    unifiedDiff: undefined
  };
}
