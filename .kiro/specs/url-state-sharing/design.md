# Design Document: URL-Based State Sharing

## Overview

This design document describes the implementation of a URL-based state sharing feature for the task management application. The feature enables users to share their complete application state (projects, tasks, sections, dependencies, TMS state, and settings) via a shareable URL without requiring backend infrastructure.

The solution leverages client-side compression and URL encoding to minimize URL length while maintaining data integrity. The implementation integrates seamlessly with the existing LocalStorage-based persistence layer and provides a non-destructive way to preview shared states.

### Key Design Decisions

1. **Hash Fragment Storage**: Store encoded state in the URL hash fragment (#data=...) rather than query parameters to avoid server-side processing and enable client-side-only operation
2. **LZMA Compression + Base64 Encoding**: Use the LZMA compression algorithm via the `lzma` npm package for superior compression ratios, followed by base64url encoding for URL safety
3. **Non-Destructive Loading**: Load shared state into application without permanently overwriting localStorage, allowing users to preview shared states
4. **Progressive Enhancement**: Integrate with existing ImportExportMenu component for consistent UX
5. **URL Length Warnings**: Implement tiered warnings at 2000 and 8000 character thresholds

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │ ImportExportMenu │◄────────┤   ShareButton        │     │
│  │   Component      │         │   Component          │     │
│  └────────┬─────────┘         └──────────┬───────────┘     │
│           │                              │                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ShareService                             │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │  │
│  │  │ generateShareURL│  │ loadSharedState          │   │  │
│  │  └────────┬────────┘  └──────────┬───────────────┘   │  │
│  │           │                      │                    │  │
│  │           ▼                      ▼                    │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │  │
│  │  │ compressState  │  │ decompressState          │   │  │
│  │  └────────┬────────┘  └──────────┬───────────────┘   │  │
│  │           │                      │                    │  │
│  │           ▼                      ▼                    │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │  │
│  │  │ encodeForURL   │  │ decodeFromURL            │   │  │
│  │  └────────────────┘  └──────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         LocalStorageAdapter                           │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │  │
│  │  │ exportToJSON   │  │ importFromJSON           │   │  │
│  │  └────────────────┘  └──────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Sharing Flow:**
1. User clicks Share button
2. ShareService calls LocalStorageAdapter.exportToJSON()
3. JSON string is compressed using LZMA algorithm
4. Compressed data is encoded to base64url
5. Encoded data is appended to URL hash fragment
6. URL is copied to clipboard
7. Success notification is displayed

**Loading Flow:**
1. Application detects hash fragment on page load
2. ShareService extracts encoded data from hash
3. Data is decoded from base64url
4. Decompressed using LZMA algorithm
5. JSON is validated against AppState schema
6. Valid state is loaded into application stores
7. Hash fragment is removed from URL
8. User can interact with shared state

## Components and Interfaces

### ShareService

The core service responsible for state serialization, compression, encoding, and URL generation.

```typescript
interface ShareService {
  /**
   * Generate a shareable URL containing the current application state
   * @returns ShareResult containing the URL or error information
   */
  generateShareURL(): ShareResult;
  
  /**
   * Load shared state from the current URL hash fragment
   * @returns LoadResult containing the state or error information
   */
  loadSharedState(): LoadResult;
  
  /**
   * Compress application state JSON string
   * @param json - Serialized application state
   * @returns Compressed string
   */
  compressState(json: string): string;
  
  /**
   * Decompress state data
   * @param compressed - Compressed state string
   * @returns Decompressed JSON string
   */
  decompressState(compressed: string): string;
  
  /**
   * Encode compressed data for URL safety
   * @param compressed - Compressed state data
   * @returns URL-safe encoded string
   */
  encodeForURL(compressed: string): string;
  
  /**
   * Decode URL-safe string back to compressed data
   * @param encoded - URL-encoded string
   * @returns Compressed state data
   */
  decodeFromURL(encoded: string): string;
  
  /**
   * Calculate URL length and determine warning level
   * @param url - Complete URL string
   * @returns URLLengthInfo with warnings
   */
  checkURLLength(url: string): URLLengthInfo;
  
  /**
   * Copy text to system clipboard
   * @param text - Text to copy
   * @returns Promise<boolean> indicating success
   */
  copyToClipboard(text: string): Promise<boolean>;
}

interface ShareResult {
  success: boolean;
  url?: string;
  error?: string;
  warning?: string;
  lengthInfo: URLLengthInfo;
}

interface LoadResult {
  success: boolean;
  state?: AppState;
  error?: string;
}

interface URLLengthInfo {
  length: number;
  warningLevel: 'none' | 'caution' | 'error';
  message?: string;
}
```

### ShareButton Component

A new component that integrates with the ImportExportMenu to provide sharing functionality.

```typescript
interface ShareButtonProps {
  onShareSuccess?: (url: string) => void;
  onShareError?: (error: string) => void;
}

/**
 * Button component that triggers state sharing
 * Displays loading state during compression/encoding
 * Shows success/error notifications
 */
function ShareButton(props: ShareButtonProps): JSX.Element;
```

### URL Hash Format

The URL hash fragment follows this format:

```
#share=<base64-encoded-compressed-state>
```

Example:
```
https://app.example.com/#share=N4IgdghgtgpiBcIDKBXA...
```

### Integration with Existing Components

The ShareButton will be added to the ImportExportMenu dropdown alongside Export and Import options:

```typescript
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={handleExport}>
    <Download className="mr-2 h-4 w-4" />
    Export Data
  </DropdownMenuItem>
  <DropdownMenuItem onClick={handleImportClick}>
    <Upload className="mr-2 h-4 w-4" />
    Import Data
  </DropdownMenuItem>
  <DropdownMenuItem onClick={handleShare}>
    <Share className="mr-2 h-4 w-4" />
    Share via URL
  </DropdownMenuItem>
</DropdownMenuContent>
```

## Data Models

### Compression Strategy

The application will use the **lzma** npm package which implements the LZMA compression algorithm, followed by base64url encoding:
- Superior compression ratios compared to other JavaScript compression libraries (typically 70-90% reduction for JSON data)
- LZMA is the same algorithm used by 7-Zip and .xz files
- Fast decompression in browser environments
- Separate compression and decompression modules available for smaller bundle sizes
- Base64url encoding ensures URL-safe characters (no padding, uses `-` and `_` instead of `+` and `/`)

**Implementation approach:**
1. Compress JSON string using LZMA algorithm (returns byte array)
2. Convert byte array to base64url string for URL safety
3. For decompression, reverse the process: decode base64url → decompress LZMA → JSON string

### State Serialization

The existing `LocalStorageAdapter.exportToJSON()` method already provides proper serialization:

```typescript
{
  projects: Project[],
  tasks: Task[],
  sections: Section[],
  dependencies: TaskDependency[],
  tmsState: TMSState,
  settings: AppSettings,
  version: string,
  exportedAt: string  // ISO timestamp
}
```

### URL Length Estimation

Typical compression ratios for application state with LZMA:

| State Size | JSON Size | Compressed Size | Base64url Length | URL Length | Status |
|------------|-----------|-----------------|------------------|------------|--------|
| Small (1 project, 10 tasks) | ~2 KB | ~300 bytes | ~400 chars | ~450 chars | ✓ Safe |
| Medium (5 projects, 50 tasks) | ~10 KB | ~1.5 KB | ~2000 chars | ~2050 chars | ⚠ Caution |
| Large (10 projects, 200 tasks) | ~40 KB | ~6 KB | ~8000 chars | ~8050 chars | ❌ Too large |

Note: LZMA typically achieves 10-20% better compression than lz-string for JSON data.

### Error Types

```typescript
enum ShareErrorType {
  COMPRESSION_FAILED = 'compression_failed',
  ENCODING_FAILED = 'encoding_failed',
  CLIPBOARD_FAILED = 'clipboard_failed',
  URL_TOO_LONG = 'url_too_long',
  DECOMPRESSION_FAILED = 'decompression_failed',
  INVALID_DATA = 'invalid_data',
  VALIDATION_FAILED = 'validation_failed'
}

class ShareError extends Error {
  constructor(
    public type: ShareErrorType,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ShareError';
  }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Core Compression and Encoding Properties

**Property 1: Compression Round-Trip Integrity**
*For any* valid JSON string representing application state, compressing and then decompressing should produce an identical JSON string.
**Validates: Requirements 2.5**

**Property 2: URL Encoding Round-Trip Integrity**
*For any* compressed data string, encoding for URL and then decoding should produce identical compressed data.
**Validates: Requirements 3.4**

**Property 3: URL-Safe Character Set**
*For any* compressed data, the URL-encoded output should contain only characters that are safe for URL hash fragments (alphanumeric, hyphen, underscore, and URL-safe base64 characters).
**Validates: Requirements 3.1, 3.2**

**Property 4: Compression Reduces Size**
*For any* JSON string larger than 100 bytes, the compressed output should be smaller than or equal to the original size.
**Validates: Requirements 2.1**

### State Serialization Properties

**Property 5: Serialization Produces Valid JSON**
*For any* valid AppState object, serialization should produce a string that can be parsed as valid JSON.
**Validates: Requirements 1.1**

**Property 6: Error Handling for Serialization**
*For any* serialization failure, the Share_Generator should return a ShareResult with success=false and a descriptive error message rather than throwing an exception.
**Validates: Requirements 1.4**

### URL Generation Properties

**Property 7: Complete URL Generation**
*For any* valid application state, generating a share URL should produce a complete URL with the current page base and a hash fragment containing encoded data.
**Validates: Requirements 4.1, 4.2**

**Property 8: URL Length Warnings**
*For any* generated URL, if the length exceeds 2000 characters, the ShareResult should include a warning; if it exceeds 8000 characters, it should indicate an error level.
**Validates: Requirements 4.4, 9.1, 9.2, 9.3**

**Property 9: Clipboard Copy Success**
*For any* successfully generated URL, when clipboard API is available, the URL should be copied to the system clipboard.
**Validates: Requirements 5.1**

### State Loading Properties

**Property 10: Valid Encoded Data Loads Successfully**
*For any* valid AppState that has been serialized, compressed, and encoded, the Share_Loader should successfully decode, decompress, validate, and load it.
**Validates: Requirements 6.2, 6.3, 6.4**

**Property 11: Non-Destructive State Loading**
*For any* shared state that is loaded, the user's original localStorage data should remain unchanged and accessible after the shared state is loaded.
**Validates: Requirements 6.5, 10.2**

**Property 12: Post-Load Persistence**
*For any* changes made after loading shared state, those changes should be saved to localStorage and persist across page reloads.
**Validates: Requirements 10.4**

**Property 13: Normal Operation Without Shared State**
*For any* application session without a shared state hash fragment, the application should load and save to localStorage normally.
**Validates: Requirements 10.3**

### Error Handling Properties

**Property 14: Invalid URL Decoding Errors**
*For any* invalid or corrupted encoded data in the URL hash, the Share_Loader should return a LoadResult with success=false and an appropriate error message.
**Validates: Requirements 7.1**

**Property 15: Decompression Failure Handling**
*For any* data that fails decompression, the Share_Loader should return a LoadResult with success=false and indicate corrupted data.
**Validates: Requirements 7.2**

**Property 16: Validation Failure Handling**
*For any* decompressed JSON that fails AppState validation, the Share_Loader should return a LoadResult with success=false and indicate incompatible format.
**Validates: Requirements 7.3**

**Property 17: Error Recovery Fallback**
*For any* error during shared state loading, the application should fall back to the user's existing localStorage state and remain functional.
**Validates: Requirements 7.4**

**Property 18: Sharing Error Messages**
*For any* error during the sharing process (compression, encoding, or URL generation), the Share_Generator should return a ShareResult with a user-friendly error message.
**Validates: Requirements 7.5**

### Security Properties

**Property 19: AppState Data Boundary**
*For any* generated share URL, the encoded data should only contain fields defined in the AppState interface and no additional data.
**Validates: Requirements 11.1**

## Error Handling

### Error Categories

1. **Serialization Errors**
   - Cause: Invalid state structure, circular references
   - Handling: Return ShareResult with error, log details
   - User Message: "Failed to prepare data for sharing. Please try again."

2. **Compression Errors**
   - Cause: LZMA compression failure, memory issues
   - Handling: Return ShareResult with error, log details
   - User Message: "Failed to compress data. Your state may be too large."

3. **Encoding Errors**
   - Cause: Invalid characters, encoding library failure
   - Handling: Return ShareResult with error, log details
   - User Message: "Failed to encode data for URL. Please try again."

4. **Clipboard Errors**
   - Cause: Browser permissions, clipboard API unavailable
   - Handling: Show URL in text field for manual copy
   - User Message: "Couldn't copy to clipboard. Please copy the URL manually."

5. **URL Length Errors**
   - Cause: Application state too large
   - Handling: Return ShareResult with error and guidance
   - User Message: "Your application state is too large to share via URL. Consider exporting to a file instead."

6. **Decoding Errors**
   - Cause: Invalid hash fragment, corrupted URL
   - Handling: Return LoadResult with error, use localStorage
   - User Message: "Invalid share URL. Loading your saved data instead."

7. **Decompression Errors**
   - Cause: Corrupted compressed data
   - Handling: Return LoadResult with error, use localStorage
   - User Message: "Shared data is corrupted. Loading your saved data instead."

8. **Validation Errors**
   - Cause: Incompatible data format, version mismatch
   - Handling: Return LoadResult with error, use localStorage
   - User Message: "Shared data format is incompatible. Loading your saved data instead."

### Error Recovery Strategy

```typescript
// Graceful degradation pattern
try {
  const result = shareService.generateShareURL();
  if (!result.success) {
    showError(result.error);
    return;
  }
  
  if (result.warning) {
    showWarning(result.warning);
  }
  
  showSuccess("URL copied to clipboard!");
} catch (error) {
  console.error('Unexpected error during sharing:', error);
  showError('An unexpected error occurred. Please try again.');
}
```

### Logging Strategy

- Log all errors with full context for debugging
- Include state size, compression ratio, URL length in logs
- Track success/failure metrics for monitoring
- Never log actual state data (privacy concern)

## Testing Strategy

### Dual Testing Approach

The implementation will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of state serialization
- Edge cases (empty state, single project, maximum fields)
- Error conditions (invalid JSON, compression failures)
- UI interactions (button clicks, clipboard operations)
- Integration points (LocalStorageAdapter, browser APIs)

**Property-Based Tests** focus on:
- Universal properties across all inputs (round-trip integrity)
- Comprehensive input coverage through randomization
- Invariants that must hold for all valid states
- Compression and encoding correctness

### Property-Based Testing Configuration

- **Library**: fast-check (already in devDependencies)
- **Iterations**: Minimum 100 runs per property test
- **Tagging**: Each property test must reference its design document property
- **Tag Format**: `// Feature: url-state-sharing, Property N: [property description]`

### Test Organization

```
lib/
  share/
    shareService.ts
    shareService.test.ts          # Unit tests
    shareService.property.test.ts # Property-based tests
    
components/
  ShareButton.tsx
  ShareButton.test.tsx            # Unit tests
  
app/
  page.tsx                        # Integration with hash loading
  page.share.test.tsx             # Integration tests
```

### Key Test Scenarios

**Unit Test Examples:**
- Empty state serialization
- Single project with no tasks
- Large state with 100+ tasks
- State with all TMS systems configured
- Clipboard API unavailable fallback
- URL length warning thresholds
- Hash fragment detection on load
- Error message display

**Property Test Examples:**
- Compression round-trip for any JSON
- Encoding round-trip for any compressed data
- URL generation for any valid AppState
- State loading for any valid encoded URL
- Error handling for any invalid input
- Non-destructive loading for any shared state

### Coverage Goals

- Line coverage: >90%
- Branch coverage: >85%
- Property test iterations: 100+ per property
- All error paths tested
- All user-facing messages verified

## Implementation Notes

### Dependencies

Add lzma to package.json:
```json
{
  "dependencies": {
    "lzma": "^2.3.2"
  }
}
```

### Browser Compatibility

- Clipboard API: Fallback to text field for older browsers
- URL hash manipulation: Supported in all modern browsers
- LZMA compression: Works in all browsers with ES5+ support, uses Web Workers when available for better performance
- Base64url encoding: Native browser support via btoa/atob with character substitution

### Performance Considerations

- LZMA compression is slower than simpler algorithms but provides superior compression ratios
- Compression typically takes 100-500ms for typical states (runs asynchronously via Web Workers when available)
- Decompression is faster, typically <100ms
- URL generation shows loading indicator during compression
- No impact on normal application performance (compression only happens on-demand)

### Future Enhancements

1. **QR Code Generation**: Generate QR codes for mobile sharing
2. **Short URL Service**: Optional integration with URL shortener
3. **Selective Sharing**: Allow users to choose what to share
4. **Version Migration**: Handle different AppState versions
5. **Encryption**: Optional encryption for sensitive data

### Migration Path

No migration needed - this is a new feature that doesn't affect existing data structures or storage mechanisms.
