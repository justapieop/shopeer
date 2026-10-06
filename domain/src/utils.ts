export function isBlankString(str: string): boolean {
  return /^\s*$/.test(str);
}

export function isAlphaNumericString(str: string): boolean { 
  return /^[a-zA-Z0-9]+$/.test(str);
}

export function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
