import { ComparisonResult, ConfigFile } from '@/types';

export const MASK = '••••••';

// A term counts when it ends a word, so dbPassword, AUTH_TOKEN, clientsecret
// and tokens[0] match while author, authority, secretary and tokenizer don't.
// bin/configdiff.js has a copy of this rule, keep the two in step.
const SECRET_KEY = /(password|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|credential|auth)s?(?![a-z])/g;
// A token key with any of these words in it is a count (max_output_tokens, tokenLimit)
const COUNT_WORDS = /^(max|min|num|total|count|limit|per|budget|usage|length|size)$/;

// Takes a key or a dotted path. A path is secret when any key on it is,
// which masks everything under a secret key too.
export function isSecretKey(key: string): boolean {
  // Quick way out for most keys: every term above has one of these in it
  if (!/pass|pwd|secret|token|key|credential|auth/.test(key.toLowerCase().replaceAll('\0', ''))) return false;
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

// Keys of a walkable value that hold secrets whatever they're called: data and
// stringData in a Kubernetes Secret, and value in .NET's <add key="DbPassword"
// value="..."/>. bin/configdiff.js has a copy, keep the two in step.
function hidden(v: any): string[] {
  if (v.kind === 'Secret') return ['data', 'stringData'];
  if (typeof v['@_key'] === 'string' && isSecretKey(v['@_key'])) return ['@_value'];
  return [];
}

// Dotted paths of the hidden keys anywhere in a parsed config
function hiddenPaths(value: any, path = ''): string[] {
  if (!walkable(value)) return [];
  const at = (k: string) => (path ? `${path}.${k}` : k);
  return [...hidden(value).map(at), ...Object.entries(value).flatMap(([k, v]) => hiddenPaths(v, at(k)))];
}

export const hasSecrets = (value: any): boolean =>
  walkable(value) && (hidden(value).some(k => k in value) ||
    Object.entries(value).some(([k, v]) => isSecretKey(k) || hasSecrets(v)));

// Hands back the same value when nothing under it is secret
export function maskValue(value: any, key: string): any {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return MASK;
  if (!hasSecrets(value)) return value;
  if (Array.isArray(value)) return value.map(v => maskValue(v, ''));
  const h = hidden(value);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, h.includes(k) && v != null ? MASK : maskValue(v, k)]));
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
  const cased = new Map<string, string>();
  for (const k of keys) if (!cased.has(k.toLowerCase())) cased.set(k.toLowerCase(), k);
  // Shortest key wins, so a dotted llm.maxTokens key beside llm stays masked
  const written = (path: string) => {
    for (const m of path.matchAll(/[.[]|$/g)) {
      const k = cased.get(path.slice(0, m.index));
      if (k) return k + path.slice(m.index);
    }
    return path;
  };
  // Each side goes by its own document, like the files below
  const hidL = hiddenPaths(l.parsedContent);
  const hidR = hiddenPaths(r.parsedContent);
  const mask = (v: any, path: string, hid: string[]) =>
    v != null && (top.some(t => under(path, t)) || hid.some(t => under(written(path), t)))
      ? MASK : maskValue(v, written(path));

  // Raw text can't be masked reliably, so it's dropped. That empties the raw
  // view and the patch context lines until secrets are shown.
  const file = (f: ConfigFile): ConfigFile => ({ ...f, content: '', parsedContent: maskValue(f.parsedContent, '') });

  return {
    ...result,
    changes: result.changes.map(c => ({ ...c, oldValue: mask(c.oldValue, c.path, hidL), newValue: mask(c.newValue, c.path, hidR) })),
    leftFile: file(l),
    rightFile: file(r),
    unifiedDiff: undefined
  };
}
