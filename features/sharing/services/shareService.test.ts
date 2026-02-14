import { describe, it, expect, beforeEach } from 'vitest';
import { ShareService, ShareError, ShareErrorType } from './shareService';
import { LocalStorageAdapter } from '@/lib/storage';

describe('ShareService', () => {
  let shareService: ShareService;

  beforeEach(() => {
    shareService = new ShareService();
  });

  describe('encodeForURL and decodeFromURL', () => {
    it('should encode and decode byte arrays correctly', () => {
      const testData = [72, 101, 108, 108, 111]; // "Hello" in ASCII
      
      const encoded = shareService.encodeForURL(testData);
      expect(encoded).toBeTruthy();
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      
      const decoded = shareService.decodeFromURL(encoded);
      expect(decoded).toEqual(testData);
    });

    it('should handle empty arrays', () => {
      const testData: number[] = [];
      
      const encoded = shareService.encodeForURL(testData);
      const decoded = shareService.decodeFromURL(encoded);
      
      expect(decoded).toEqual(testData);
    });
  });

  describe('checkURLLength', () => {
    it('should return none for short URLs', () => {
      const url = 'https://example.com/#share=abc123';
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('none');
      expect(result.length).toBe(url.length);
      expect(result.message).toBeUndefined();
    });

    it('should return caution for URLs over 2000 characters', () => {
      const url = 'https://example.com/#share=' + 'a'.repeat(2000);
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('caution');
      expect(result.message).toBeTruthy();
    });

    it('should return error for URLs over 8000 characters', () => {
      const url = 'https://example.com/#share=' + 'a'.repeat(8000);
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('error');
      expect(result.message).toBeTruthy();
    });
  });

  describe('serializeState', () => {
    it('should serialize application state', () => {
      const json = shareService.serializeState();
      
      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('projects');
      expect(parsed).toHaveProperty('tasks');
      expect(parsed).toHaveProperty('sections');
      expect(parsed).toHaveProperty('dependencies');
    });
  });

  describe('extractHashData', () => {
    it('should return null when no hash is present', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBeNull();
      
      // Restore
      window.location = originalLocation;
    });

    it('should return null when hash does not start with #share=', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '#other=data' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBeNull();
      
      window.location = originalLocation;
    });

    it('should extract data after #share=', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '#share=abc123' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBe('abc123');
      
      window.location = originalLocation;
    });
  });
});
