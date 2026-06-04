import { describe, it, expect } from 'vitest';
import {
  parseRefPath,
  extractReadonlyRefs,
  isTwoWayRefString,
  isInvalidTwoWayMix,
  classifyTwoWayString,
  parseTwoWayRef,
} from '../../projects/blocks-studio/src/lib/core/block-loader/ref-expressions';

describe('ref-expressions', () => {
  describe('parseRefPath', () => {
    it('parses current block path (no colon)', () => {
      expect(parseRefPath('FormState')).toEqual({ serviceOrModel: 'FormState', pathParts: [] });
      expect(parseRefPath('model.age')).toEqual({
        serviceOrModel: 'model',
        pathParts: ['age'],
      });
      expect(parseRefPath('FormState.firstName')).toEqual({
        serviceOrModel: 'FormState',
        pathParts: ['firstName'],
      });
    });

    it('parses block-prefixed path (with colon)', () => {
      expect(parseRefPath('PersonForm:FormState.firstName')).toEqual({
        blockId: 'PersonForm',
        serviceOrModel: 'FormState',
        pathParts: ['firstName'],
      });
      expect(parseRefPath('BlockID:model.info.title')).toEqual({
        blockId: 'BlockID',
        serviceOrModel: 'model',
        pathParts: ['info', 'title'],
      });
    });

    it('trims whitespace', () => {
      expect(parseRefPath('  FormState  ')).toEqual({
        serviceOrModel: 'FormState',
        pathParts: [],
      });
    });

    it('returns empty serviceOrModel for empty string', () => {
      expect(parseRefPath('')).toEqual({ serviceOrModel: '', pathParts: [] });
    });

    it('throws for invalid block id (with dot)', () => {
      expect(() => parseRefPath('a.b:c')).toThrow('Invalid block id');
    });
  });

  describe('extractReadonlyRefs', () => {
    it('extracts single {{ ref }}', () => {
      expect(extractReadonlyRefs('Hello {{ FormState.name }}')).toEqual(['FormState.name']);
    });

    it('extracts multiple refs and dedupes', () => {
      expect(extractReadonlyRefs('{{ a }} and {{ b }} and {{ a }}')).toEqual(['a', 'b']);
    });

    it('returns empty for no placeholders', () => {
      expect(extractReadonlyRefs('plain text')).toEqual([]);
    });
  });

  describe('isTwoWayRefString', () => {
    it('returns true for exact [( refPath )]', () => {
      expect(isTwoWayRefString('[(FormState.name)]')).toBe(true);
      expect(isTwoWayRefString('[(PersonForm:FormState.age)]')).toBe(true);
    });

    it('returns false for non-string', () => {
      expect(isTwoWayRefString(null)).toBe(false);
      expect(isTwoWayRefString(123)).toBe(false);
    });

    it('returns false for string with extra text', () => {
      expect(isTwoWayRefString('prefix [(x)]')).toBe(false);
      expect(isTwoWayRefString('[(x)] suffix')).toBe(false);
    });
  });

  describe('isInvalidTwoWayMix', () => {
    it('returns true when two-way delimiters mixed with other content', () => {
      expect(isInvalidTwoWayMix('[(x)] and {{y}}')).toBe(true);
      expect(isInvalidTwoWayMix('prefix [(x)]')).toBe(true);
    });

    it('returns false for valid standalone two-way ref', () => {
      expect(isInvalidTwoWayMix('[(x)]')).toBe(false);
    });
  });

  describe('classifyTwoWayString', () => {
    it('returns "two-way" for exact [( refPath )]', () => {
      expect(classifyTwoWayString('[(FormState.x)]')).toBe('two-way');
    });

    it('returns "invalid-mix" when delimiters present but not exact form', () => {
      expect(classifyTwoWayString('[(x)] and more')).toBe('invalid-mix');
    });

    it('returns "none" when no two-way delimiters', () => {
      expect(classifyTwoWayString('{{ x }}')).toBe('none');
      expect(classifyTwoWayString('plain')).toBe('none');
    });

    it('returns "none" for non-string', () => {
      expect(classifyTwoWayString(42)).toBe('none');
    });
  });

  describe('parseTwoWayRef', () => {
    it('extracts ref path from [( path )]', () => {
      expect(parseTwoWayRef('[(FormState.firstName)]')).toBe('FormState.firstName');
      expect(parseTwoWayRef('[(Block:model.x)]')).toBe('Block:model.x');
    });

    it('returns null for invalid form', () => {
      expect(parseTwoWayRef('[(x)] extra')).toBe(null);
      expect(parseTwoWayRef('{{ x }}')).toBe(null);
    });
  });
});
