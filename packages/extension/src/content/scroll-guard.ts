let programmaticUntil = 0;

/** Mark a short window during which scroll events come from us, not the user. */
export function markProgrammaticScroll(durationMs = 150): void {
  programmaticUntil = Date.now() + durationMs;
}

export function isProgrammaticScroll(): boolean {
  return Date.now() < programmaticUntil;
}
