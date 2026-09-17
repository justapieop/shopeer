export function isBlankString(str: string): boolean {
  return /^\s*$/.test(str);
}

export function isAlphaNumericString(str: string): boolean { 
  return /^[a-zA-Z0-9]+$/.test(str);
}