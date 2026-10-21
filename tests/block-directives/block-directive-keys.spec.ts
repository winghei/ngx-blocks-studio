import { describe, it, expect } from 'vitest';
import { getServicesKey, safeJsonKey } from '../../projects/blocks-studio/src/lib/core/block-loader/block-directive-keys';

describe('getServicesKey', () => {
  it('returns empty string when services are absent', () => {
    expect(getServicesKey(undefined)).toBe('');
    expect(getServicesKey([])).toBe('');
  });

  it('joins string and object service entries', () => {
    expect(getServicesKey(['A', { id: 'B', scope: 'self' }])).toBe('A,B:self');
    expect(getServicesKey([{ id: 'Only' }])).toBe('Only:');
  });
});

describe('safeJsonKey', () => {
  it('stringifies plain objects', () => {
    expect(safeJsonKey({ component: 'X' })).toBe('{"component":"X"}');
  });

  it('uses null for undefined values', () => {
    expect(safeJsonKey(undefined)).toBe('null');
  });

  it('falls back to String when JSON.stringify throws', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(safeJsonKey(circular)).toBe('[object Object]');
  });
});
