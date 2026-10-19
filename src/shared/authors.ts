/**
 * Key used to compare author names: Unicode NFKC, lowercase and collapsed
 * whitespace. Accents and commas are preserved; there is no fuzzy matching.
 */
export function authorKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Display form of a name: NFC with collapsed whitespace. */
export function cleanAuthorName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim()
}
