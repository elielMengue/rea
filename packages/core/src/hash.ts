export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashKey(input: string): string {
  return fnv1a(input).toString(36) + fnv1a(input, 0x9e3779b9).toString(36);
}
