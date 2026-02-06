import { describe, it, expect } from 'vitest';
import { getTMSHandler } from './index';
import { TimeManagementSystem } from '@/types';

describe('TMS Factory', () => {
  it('should return DITHandler for DIT system', () => {
    const handler = getTMSHandler(TimeManagementSystem.DIT);
    expect(handler.name).toBe(TimeManagementSystem.DIT);
  });

  it('should return AF4Handler for AF4 system', () => {
    const handler = getTMSHandler(TimeManagementSystem.AF4);
    expect(handler.name).toBe(TimeManagementSystem.AF4);
  });

  it('should return FVPHandler for FVP system', () => {
    const handler = getTMSHandler(TimeManagementSystem.FVP);
    expect(handler.name).toBe(TimeManagementSystem.FVP);
  });

  it('should return StandardHandler for NONE system', () => {
    const handler = getTMSHandler(TimeManagementSystem.NONE);
    expect(handler.name).toBe(TimeManagementSystem.NONE);
  });

  it('should throw error for unknown system', () => {
    expect(() => getTMSHandler('unknown' as TimeManagementSystem)).toThrow('Unknown time management system');
  });
});
