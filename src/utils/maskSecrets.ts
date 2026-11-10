import { ComparisonResult, ConfigFile } from '@/types';

export const MASK = '••••••';

// A term counts when it ends a word, so dbPassword, AUTH_TOKEN, clientsecret
// and tokens[0] match while author, authority, secretary and tokenizer don't.
// bin/configdiff.js has a copy of this rule, keep the two in step.
const SECRET_KEY = /(password|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|credential|auth)s?(?![a-z])/;

// Takes a key or a dotted path. A path is secret when any key on it is,
// which masks everything under a secret key too.
export function isSecretKey(key: string): boolean {
  const k = key
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  return SECRET_KEY.test(k);
}

export function maskValue(value: any, key: string): any {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return MASK;
  if (Array.isArray(value)) return value.map(v => maskValue(v, ''));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskValue(v, k)]));
  }
  return value;
}

export const hasSecrets = (value: any): boolean =>
  value !== null && typeof value === 'object' &&
  Object.entries(value).some(([k, v]) => isSecretKey(k) || hasSecrets(v));

// Display copy of a result. The diff already ran on the real values, so change
// types and counts don't move. Returns the result itself when there's nothing to hide.
export function maskResult(result: ComparisonResult): ComparisonResult {
  const { leftFile: l, rightFile: r } = result;
  if (!hasSecrets(l.parsedContent) && !hasSecrets(r.parsedContent)) return result;

  // generateDiff lowercases top-level keys unless case-sensitive, so secretKey arrives as secretkey
  const top = new Set(
    [...Object.keys(l.parsedContent ?? {}), ...Object.keys(r.parsedContent ?? {})]
      .filter(isSecretKey)
      .map(k => k.toLowerCase())
  );
  const mask = (v: any, path: string) =>
    v != null && top.has(path.split(/[.[]/)[0]) ? MASK : maskValue(v, path);

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
