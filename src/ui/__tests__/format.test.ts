import { describe, expect, it } from 'vitest';
import { formatNumber } from '../format';

describe('numeri in formato italiano', () => {
  it.each([
    [897.3027, 0, '897'],
    [1218, 0, '1.218'],
    [1435.68, 2, '1.435,68'],
    [109.996, 3, '109,996'],
    [100000, 0, '100.000'],
    [0.0499, 2, '0,05'],
    [-1234.5, 1, '-1.234,5'],
    [-0.001, 2, '0,00'],
  ])('%d con %d decimali → %s', (value, decimals, text) => {
    expect(formatNumber(value, decimals)).toBe(text);
  });
});
