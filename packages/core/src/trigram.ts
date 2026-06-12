export function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  if (text.length < 3) {
    if (text) set.add(text);
    return set;
  }
  for (let i = 0; i <= text.length - 3; i++) {
    set.add(text.slice(i, i + 3));
  }
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) {
    if (large.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}
