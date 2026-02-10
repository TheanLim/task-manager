import { AppState } from '@/types';
import { LocalStorageAdapter } from '@/lib/storage';
import { TimeManagementSystem } from '@/types';

// LZMA global object interface (when loading lzma_worker.js directly)
interface LZMAGlobal {
  compress(
    data: string | number[],
    mode: number,
    onFinish: (result: number[], error?: Error) => void,
    onProgress?: (percent: number) => void
  ): void;
  decompress(
    data: number[],
    onFinish: (result: string | Uint8Array, error?: Error) => void,
    onProgress?: (percent: number) => void
  ): void;
}

declare global {
  interface Window {
    LZMA?: LZMAGlobal;
  }
}

/**
 * Error types for share operations
 */
export enum ShareErrorType {
  COMPRESSION_FAILED = 'compression_failed',
  ENCODING_FAILED = 'encoding_failed',
  CLIPBOARD_FAILED = 'clipboard_failed',
  URL_TOO_LONG = 'url_too_long',
  DECOMPRESSION_FAILED = 'decompression_failed',
  INVALID_DATA = 'invalid_data',
  VALIDATION_FAILED = 'validation_failed',
  SERIALIZATION_FAILED = 'serialization_failed'
}

/**
 * Custom error for share operations
 */
export class ShareError extends Error {
  constructor(
    public type: ShareErrorType,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ShareError';
  }
}

/**
 * URL length information with warning levels
 */
export interface URLLengthInfo {
  length: number;
  warningLevel: 'none' | 'caution' | 'error';
  message?: string;
}

/**
 * Result of share URL generation
 */
export interface ShareResult {
  success: boolean;
  url?: string;
  error?: string;
  warning?: string;
  lengthInfo: URLLengthInfo;
}

/**
 * Result of loading shared state
 */
export interface LoadResult {
  success: boolean;
  state?: AppState;
  error?: string;
}

/**
 * Service for sharing application state via URL
 */
export class ShareService {
  private storageAdapter: LocalStorageAdapter;
  private lzmaLoaded: boolean = false;

  constructor(storageAdapter?: LocalStorageAdapter) {
    this.storageAdapter = storageAdapter || new LocalStorageAdapter();
  }

  /**
   * Load LZMA library (lzma_worker.js creates global LZMA object)
   */
  private async loadLZMA(): Promise<LZMAGlobal> {
    if (this.lzmaLoaded && window.LZMA) {
      return window.LZMA;
    }

    // Check if already loaded
    if (typeof window !== 'undefined' && window.LZMA) {
      this.lzmaLoaded = true;
      return window.LZMA;
    }

    // Load the worker script (creates global LZMA object)
    await new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('LZMA can only be used in browser'));
        return;
      }

      const script = document.createElement('script');
      script.src = '/lzma_worker.js';
      script.async = true;
      
      script.onload = () => {
        if (window.LZMA) {
          this.lzmaLoaded = true;
          resolve();
        } else {
          reject(new Error('LZMA not found after script load'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load LZMA script'));
      };
      
      document.head.appendChild(script);
    });

    if (!window.LZMA) {
      throw new Error('LZMA library not available');
    }

    return window.LZMA;
  }

  /**
   * Generate a shareable URL containing the current application state
   * @param currentState Optional current state to use instead of reading from storage
   */
  async generateShareURL(currentState?: AppState): Promise<ShareResult> {
    try {
      // Serialize state
      console.log('[ShareService] Serializing state...');
      const json = this.serializeState(currentState);
      console.log('[ShareService] State serialized, length:', json.length);
      
      // Compress state
      console.log('[ShareService] Compressing state...');
      const compressed = await this.compressState(json);
      console.log('[ShareService] State compressed, byte count:', compressed.length);
      
      // Encode for URL
      console.log('[ShareService] Encoding for URL...');
      const encoded = this.encodeForURL(compressed);
      console.log('[ShareService] Encoded, length:', encoded.length);
      
      // Build URL with hash fragment
      const baseUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}${window.location.pathname}`
        : '';
      const url = `${baseUrl}#share=${encoded}`;
      
      // Check URL length
      const lengthInfo = this.checkURLLength(url);
      console.log('[ShareService] URL generated successfully, length:', lengthInfo.length);
      
      // Return result with warnings if needed
      return {
        success: true,
        url,
        warning: lengthInfo.message,
        lengthInfo
      };
    } catch (error) {
      console.error('[ShareService] Error generating share URL:', error);
      
      if (error instanceof ShareError) {
        return {
          success: false,
          error: error.message,
          lengthInfo: { length: 0, warningLevel: 'none' }
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to generate share URL: ${errorMessage}`,
        lengthInfo: { length: 0, warningLevel: 'none' }
      };
    }
  }

  /**
   * Load shared state from the current URL hash fragment
   */
  async loadSharedState(): Promise<LoadResult> {
    try {
      // Extract hash data
      const encoded = this.extractHashData();
      
      if (!encoded) {
        return {
          success: false,
          error: 'No shared state found in URL'
        };
      }
      
      // Decode from URL
      const compressed = this.decodeFromURL(encoded);
      
      // Decompress
      const json = await this.decompressState(compressed);
      
      // Parse and validate JSON
      const parsed = JSON.parse(json);
      
      if (!this.storageAdapter.validateState(parsed)) {
        throw new ShareError(
          ShareErrorType.VALIDATION_FAILED,
          'Shared state format is incompatible'
        );
      }
      
      return {
        success: true,
        state: parsed
      };
    } catch (error) {
      if (error instanceof ShareError) {
        return {
          success: false,
          error: error.message
        };
      }
      
      if (error instanceof SyntaxError) {
        return {
          success: false,
          error: 'Invalid shared data format'
        };
      }
      
      return {
        success: false,
        error: 'Failed to load shared state'
      };
    }
  }

  /**
   * Compress application state JSON string using LZMA
   */
  async compressState(json: string): Promise<number[]> {
    try {
      console.log('[ShareService] Loading LZMA...');
      const lzma = await this.loadLZMA();
      console.log('[ShareService] LZMA loaded');
      
      return new Promise((resolve, reject) => {
        console.log('[ShareService] Starting LZMA compression...');
        lzma.compress(json, 1, (result: number[], error?: Error) => {
          if (error) {
            console.error('[ShareService] LZMA compression error:', error);
            reject(new ShareError(
              ShareErrorType.COMPRESSION_FAILED,
              'Failed to compress state data',
              error
            ));
          } else {
            console.log('[ShareService] LZMA compression complete, bytes:', result.length);
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error('[ShareService] Failed to load LZMA:', error);
      throw new ShareError(
        ShareErrorType.COMPRESSION_FAILED,
        'Failed to initialize LZMA compression',
        error
      );
    }
  }

  /**
   * Decompress LZMA byte array to JSON string
   */
  async decompressState(compressed: number[]): Promise<string> {
    try {
      const lzma = await this.loadLZMA();
      
      return new Promise((resolve, reject) => {
        lzma.decompress(compressed, (result: string | Uint8Array, error?: Error) => {
          if (error) {
            reject(new ShareError(
              ShareErrorType.DECOMPRESSION_FAILED,
              'Failed to decompress state data',
              error
            ));
          } else if (typeof result === 'string') {
            resolve(result);
          } else {
            // Convert Uint8Array to string
            const decoder = new TextDecoder();
            resolve(decoder.decode(result));
          }
        });
      });
    } catch (error) {
      throw new ShareError(
        ShareErrorType.DECOMPRESSION_FAILED,
        'Failed to initialize LZMA decompression',
        error
      );
    }
  }

  /**
   * Encode compressed data for URL safety using base64url
   */
  encodeForURL(compressed: number[]): string {
    try {
      // LZMA returns signed bytes, convert to unsigned (0-255)
      const unsignedBytes = compressed.map(byte => byte < 0 ? byte + 256 : byte);
      
      // Convert to Uint8Array for proper binary handling
      const uint8Array = new Uint8Array(unsignedBytes);
      
      // Convert to binary string
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      // Encode to base64
      const base64 = typeof btoa !== 'undefined' 
        ? btoa(binaryString)
        : Buffer.from(uint8Array).toString('base64');
      
      // Convert to base64url (URL-safe)
      // Replace + with -, / with _, and remove padding =
      const base64url = base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return base64url;
    } catch (error) {
      throw new ShareError(
        ShareErrorType.ENCODING_FAILED,
        'Failed to encode compressed data for URL',
        error
      );
    }
  }

  /**
   * Decode URL-safe string back to compressed byte array
   */
  decodeFromURL(encoded: string): number[] {
    try {
      // Convert base64url back to base64
      // Replace - with +, _ with /, and add padding if needed
      let base64 = encoded
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // Add padding
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      
      // Decode from base64
      const binaryString = typeof atob !== 'undefined'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
      
      // Convert binary string to unsigned byte array
      const unsignedBytes = Array.from(binaryString).map(c => c.charCodeAt(0));
      
      // Convert back to signed bytes (LZMA expects signed bytes)
      const signedBytes = unsignedBytes.map(byte => byte > 127 ? byte - 256 : byte);
      
      return signedBytes;
    } catch (error) {
      throw new ShareError(
        ShareErrorType.INVALID_DATA,
        'Failed to decode URL data',
        error
      );
    }
  }

  /**
   * Serialize application state to JSON
   * @param currentState Optional current state to use instead of reading from storage
   */
  serializeState(currentState?: AppState): string {
    try {
      let state: AppState;
      
      if (currentState) {
        // Use provided state
        state = currentState;
      } else {
        // Fall back to reading from storage
        state = this.storageAdapter.load() || {
          projects: [],
          tasks: [],
          sections: [],
          dependencies: [],
          tmsState: {
            activeSystem: TimeManagementSystem.NONE,
            dit: {
              todayTasks: [],
              tomorrowTasks: [],
              lastDayChange: new Date().toISOString()
            },
            af4: {
              markedTasks: [],
              markedOrder: []
            },
            fvp: {
              dottedTasks: [],
              currentX: null,
              selectionInProgress: false
            }
          },
          settings: {
            activeProjectId: null,
            timeManagementSystem: TimeManagementSystem.NONE,
            showOnlyActionableTasks: false,
            theme: 'system' as const
          },
          version: '1.0.0'
        };
      }
      
      // Add export metadata
      const exportData = {
        ...state,
        exportedAt: new Date().toISOString()
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new ShareError(
        ShareErrorType.SERIALIZATION_FAILED,
        'Failed to serialize application state',
        error
      );
    }
  }

  /**
   * Extract encoded data from URL hash fragment
   */
  extractHashData(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const hash = window.location.hash;
    
    // Check if hash starts with #share=
    if (!hash || !hash.startsWith('#share=')) {
      return null;
    }
    
    // Extract the encoded data after #share=
    const encoded = hash.substring(7); // Remove '#share='
    
    return encoded || null;
  }

  /**
   * Calculate URL length and determine warning level
   */
  checkURLLength(url: string): URLLengthInfo {
    const length = url.length;
    
    if (length > 8000) {
      return {
        length,
        warningLevel: 'error',
        message: 'URL is too long (>8000 characters). Some browsers may not support this. Consider exporting to a file instead.'
      };
    } else if (length > 2000) {
      return {
        length,
        warningLevel: 'caution',
        message: 'URL is quite long (>2000 characters). May have compatibility issues with some browsers or services.'
      };
    } else {
      return {
        length,
        warningLevel: 'none'
      };
    }
  }

  /**
   * Copy text to system clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      // Check if clipboard API is available
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // Fallback: clipboard API not available
      return false;
    } catch (error) {
      // Clipboard write failed (permissions, etc.)
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
}
