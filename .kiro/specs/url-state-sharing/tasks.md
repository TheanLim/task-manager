# Implementation Plan: URL-Based State Sharing

## Overview

This implementation plan breaks down the URL-based state sharing feature into discrete, testable tasks. The approach follows a bottom-up strategy: first implementing core services (compression, encoding, serialization), then building the UI components, and finally integrating with the application lifecycle for automatic state loading.

## Tasks

- [ ] 1. Add lzma dependency and create ShareService foundation
  - Add lzma to package.json dependencies
  - Create lib/share/shareService.ts with TypeScript interfaces (ShareResult, LoadResult, URLLengthInfo, ShareErrorType)
  - Create ShareError class extending Error
  - Set up basic service structure with empty method stubs
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 2. Implement compression and encoding functions
  - [ ] 2.1 Implement compressState method using LZMA compression
    - Use LZMA.compress() to compress JSON string to byte array
    - Handle compression errors and wrap in ShareError
    - Support async compression with callback/promise
    - _Requirements: 2.1, 2.4_
  
  - [ ] 2.2 Implement encodeForURL method for base64url encoding
    - Convert LZMA byte array to base64url string
    - Use URL-safe characters (replace + with -, / with _, remove padding =)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 2.3 Write property test for compression round-trip
    - **Property 1: Compression Round-Trip Integrity**
    - **Validates: Requirements 2.5**
  
  - [ ] 2.4 Implement decodeFromURL method for base64url decoding
    - Convert base64url string back to byte array
    - Reverse URL-safe character substitutions
    - _Requirements: 3.4_
  
  - [ ] 2.5 Implement decompressState method using LZMA decompression
    - Use LZMA.decompress() to decompress byte array to JSON string
    - Handle decompression errors and wrap in ShareError
    - Support async decompression with callback/promise
    - _Requirements: 2.5, 3.4_
  
  - [ ]* 2.6 Write property test for URL encoding round-trip
    - **Property 2: URL Encoding Round-Trip Integrity**
    - **Validates: Requirements 3.4**
  
  - [ ]* 2.7 Write property test for URL-safe character set
    - **Property 3: URL-Safe Character Set**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 2.8 Write property test for compression size reduction
    - **Property 4: Compression Reduces Size**
    - **Validates: Requirements 2.1**

- [ ] 3. Implement state serialization and validation
  - [ ] 3.1 Implement serializeState method using LocalStorageAdapter
    - Call LocalStorageAdapter.exportToJSON()
    - Handle serialization errors gracefully
    - Return ShareResult with error on failure
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 3.2 Write property test for serialization producing valid JSON
    - **Property 5: Serialization Produces Valid JSON**
    - **Validates: Requirements 1.1**
  
  - [ ]* 3.3 Write property test for serialization error handling
    - **Property 6: Error Handling for Serialization**
    - **Validates: Requirements 1.4**
  
  - [ ]* 3.4 Write unit test for empty state serialization
    - Test edge case of empty AppState
    - _Requirements: 1.3_

- [ ] 4. Implement URL generation and length checking
  - [ ] 4.1 Implement checkURLLength method
    - Calculate URL length
    - Return URLLengthInfo with appropriate warning level (none/caution/error)
    - Set thresholds: caution at 2000 chars, error at 8000 chars
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 4.2 Implement generateShareURL method
    - Serialize state using serializeState
    - Compress using compressState (async with loading state)
    - Encode using encodeForURL
    - Build URL with hash fragment format: #share=<encoded-data>
    - Check URL length and add warnings
    - Return ShareResult with url, warnings, and length info
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 4.3 Write property test for complete URL generation
    - **Property 7: Complete URL Generation**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ]* 4.4 Write property test for URL length warnings
    - **Property 8: URL Length Warnings**
    - **Validates: Requirements 4.4, 9.1, 9.2, 9.3**
  
  - [ ]* 4.5 Write unit tests for URL length thresholds
    - Test warning at 2000 characters
    - Test error at 8000 characters
    - _Requirements: 9.2, 9.3_

- [ ] 5. Implement clipboard functionality
  - [ ] 5.1 Implement copyToClipboard method
    - Use navigator.clipboard.writeText when available
    - Return Promise<boolean> indicating success
    - Handle clipboard API unavailable gracefully
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 5.2 Write property test for clipboard copy success
    - **Property 9: Clipboard Copy Success**
    - **Validates: Requirements 5.1**
  
  - [ ]* 5.3 Write unit tests for clipboard fallback scenarios
    - Test when clipboard API is unavailable
    - Test when clipboard write fails
    - _Requirements: 5.3_

- [ ] 6. Checkpoint - Ensure sharing functionality tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement state loading from URL
  - [ ] 7.1 Implement extractHashData method
    - Parse URL hash fragment
    - Extract encoded data after #share=
    - Return null if no share data present
    - _Requirements: 6.1_
  
  - [ ] 7.2 Implement loadSharedState method
    - Extract hash data using extractHashData
    - Decode using decodeFromURL
    - Decompress using decompressState (async)
    - Parse JSON and validate using LocalStorageAdapter.validateState
    - Return LoadResult with state or error
    - _Requirements: 6.2, 6.3, 6.4_
  
  - [ ]* 7.3 Write property test for valid encoded data loading
    - **Property 10: Valid Encoded Data Loads Successfully**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  
  - [ ]* 7.4 Write property test for invalid URL decoding errors
    - **Property 14: Invalid URL Decoding Errors**
    - **Validates: Requirements 7.1**
  
  - [ ]* 7.5 Write property test for decompression failure handling
    - **Property 15: Decompression Failure Handling**
    - **Validates: Requirements 7.2**
  
  - [ ]* 7.6 Write property test for validation failure handling
    - **Property 16: Validation Failure Handling**
    - **Validates: Requirements 7.3**
  
  - [ ]* 7.7 Write unit test for hash fragment detection
    - Test with valid hash fragment
    - Test with no hash fragment
    - Test with invalid hash format
    - _Requirements: 6.1_

- [ ] 8. Implement error recovery and fallback logic
  - [ ] 8.1 Add error recovery to loadSharedState
    - Wrap loading logic in try-catch
    - Return LoadResult with error on any failure
    - Ensure application can continue with localStorage
    - _Requirements: 7.4_
  
  - [ ]* 8.2 Write property test for error recovery fallback
    - **Property 17: Error Recovery Fallback**
    - **Validates: Requirements 7.4**
  
  - [ ]* 8.3 Write property test for sharing error messages
    - **Property 18: Sharing Error Messages**
    - **Validates: Requirements 7.5**

- [ ] 9. Create ShareButton component
  - [ ] 9.1 Create components/ShareButton.tsx
    - Create functional component with ShareButtonProps interface
    - Add Share icon from lucide-react
    - Implement onClick handler that calls shareService.generateShareURL()
    - Show loading state during sharing
    - Call copyToClipboard on success
    - Display success/error notifications using toast
    - Show URL in text field if clipboard fails
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 5.2, 5.3_
  
  - [ ]* 9.2 Write unit tests for ShareButton component
    - Test button renders correctly
    - Test loading state during sharing
    - Test success notification
    - Test error notification
    - Test clipboard fallback UI
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 5.2, 5.3_
  
  - [ ]* 9.3 Write unit test for keyboard accessibility
    - Test button is keyboard navigable
    - _Requirements: 8.5_

- [ ] 10. Integrate ShareButton into ImportExportMenu
  - [ ] 10.1 Update ImportExportMenu component
    - Import ShareButton component
    - Add Share menu item to dropdown
    - Add Share icon from lucide-react
    - Wire up handleShare function
    - Display ShareDialog with URL and copy functionality
    - _Requirements: 8.1, 11.3_
  
  - [ ]* 10.2 Write integration tests for ImportExportMenu
    - Test Share menu item appears
    - Test Share dialog opens on click
    - Test privacy warning is displayed
    - _Requirements: 8.1, 11.3_

- [ ] 11. Checkpoint - Ensure UI components tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement automatic state loading on page load
  - [ ] 12.1 Add useEffect hook to app/page.tsx for hash detection
    - Check for hash fragment on mount
    - Call shareService.loadSharedState()
    - Load state into Zustand stores if valid
    - Display error toast if loading fails
    - Remove hash fragment after loading
    - _Requirements: 6.1, 6.4, 6.6, 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 12.2 Write property test for non-destructive state loading
    - **Property 11: Non-Destructive State Loading**
    - **Validates: Requirements 6.5, 10.2**
  
  - [ ]* 12.3 Write property test for post-load persistence
    - **Property 12: Post-Load Persistence**
    - **Validates: Requirements 10.4**
  
  - [ ]* 12.4 Write property test for normal operation without shared state
    - **Property 13: Normal Operation Without Shared State**
    - **Validates: Requirements 10.3**
  
  - [ ]* 12.5 Write integration tests for page load scenarios
    - Test loading with valid share URL
    - Test loading with invalid share URL
    - Test loading without share URL
    - Test hash removal after load
    - _Requirements: 6.1, 6.6_

- [ ] 13. Implement security and data boundary checks
  - [ ] 13.1 Add validation to ensure only AppState fields are shared
    - Verify serialized data matches AppState interface
    - Strip any extra fields before compression
    - _Requirements: 11.1_
  
  - [ ]* 13.2 Write property test for AppState data boundary
    - **Property 19: AppState Data Boundary**
    - **Validates: Requirements 11.1**
  
  - [ ]* 13.3 Write unit test for privacy warning display
    - Test warning appears when generating share URL
    - _Requirements: 11.3_

- [ ] 14. Add comprehensive error handling and logging
  - [ ] 14.1 Implement error logging in ShareService
    - Log all errors with context (state size, URL length, error type)
    - Never log actual state data
    - Add console.error for debugging
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 14.2 Write unit tests for error logging
    - Test errors are logged with context
    - Test state data is not logged
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 15. Final checkpoint - Run all tests and verify integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: services first, then UI, then integration
- LZMA compression is asynchronous and may use Web Workers for better performance
- Base64url encoding ensures URL-safe characters without padding
