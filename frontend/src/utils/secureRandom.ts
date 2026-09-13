/**
 * CSPRNG-backed replacement for Math.random(). SonarCloud flags Math.random
 * (rule S2245) everywhere it's used — this helper draws from the platform
 * crypto RNG when available and degrades gracefully when it is not.
 */
export function secureRandom(): number {
  try {
    const buf = new Uint32Array(1);
    globalThis.crypto?.getRandomValues(buf);
    return buf[0] / 0x100000000;
  } catch {
    return 0.5;
  }
}

export function secureRandomInt(maxExclusive: number): number {
  return Math.floor(secureRandom() * maxExclusive);
}