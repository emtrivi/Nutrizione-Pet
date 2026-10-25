import { describe, expect, it } from 'vitest';
import { describePrice, formatEuro, formatNumber, formatQuantity, formatSmart, unitLabel } from '../format';

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


describe('decimali scelti dalla grandezza', () => {
  it.each([
    [1218.4, '1.218'],
    [897.3, '897'],
    [63.458, '63,5'],
    [1.7661, '1,77'],
    [0.245, '0,245'],
    [0.0123456, '0,0123'],
    [0.1, '0,1'],
    [0, '0'],
  ])('%d → %s', (v, t) => {
    expect(formatSmart(v)).toBe(t);
  });
});

describe('quantità con unità leggibili', () => {
  it('0,0714 g → 71,4 mg', () => {
    expect(formatQuantity(0.0714, 'g')).toBe('71,4 mg');
  });
  it('valori piccoli scendono di unità, quelli grandi no', () => {
    expect(formatQuantity(1.766, 'g')).toBe('1,77 g');
    expect(formatQuantity(0.0004, 'mg')).toBe('0,4 µg');
    expect(formatQuantity(0, 'g')).toBe('0 g');
    expect(formatQuantity(2136.4, 'IU')).toBe('2.136 UI');
    expect(unitLabel('IU')).toBe('UI');
  });
});

describe('prezzi', () => {
  it('descrizioni', () => {
    expect(formatEuro(6.564267)).toBe('6,56 €');
    expect(describePrice({ mode: 'per_kg', eurPerKg: 12 }, 'g')).toBe('12,00 € al kg');
    expect(describePrice({ mode: 'per_package', packagePrice: 3.5, packageSize: 250 }, 'g')).toBe('3,50 € per 250 g');
    expect(describePrice({ mode: 'per_package', packagePrice: 25, packageSize: 60 }, 'capsule')).toBe('25,00 € per 60 capsule');
    expect(describePrice({ mode: 'per_unit', eurPerUnit: 0.42 }, 'capsule')).toBe('0,42 € a capsula');
  });
});
