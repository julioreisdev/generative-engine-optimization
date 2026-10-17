import { parseBoolean, parsePositiveInt } from '../../../src/config/env.js';

describe('parsePositiveInt', () => {
  it('should parse a positive integer', () => {
    expect(parsePositiveInt('5000', 1)).toBe(5000);
  });

  it.each([undefined, '', 'abc', '0', '-10', '1.5'])(
    'should use the fallback for %j',
    (value) => {
      expect(parsePositiveInt(value, 1)).toBe(1);
    },
  );
});

describe('parseBoolean', () => {
  it('should parse "true" and "false"', () => {
    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('false', true)).toBe(false);
  });

  it.each([undefined, '', 'yes', '1'])(
    'should use the fallback for %j',
    (value) => {
      expect(parseBoolean(value, true)).toBe(true);
    },
  );
});
