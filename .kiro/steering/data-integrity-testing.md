---
title: Data Integrity Testing Requirements
inclusion: auto
---

# Data Integrity Testing Requirements

## Critical Rule: CRUD Operations Must Update Data Integrity Tests

**Any code change that touches data (Create, Read, Update, Delete) MUST update and verify data integrity tests.**

## Affected Operations

### Data Structure Changes
- Adding new fields to types (Project, Task, Section, Dependency, TMSState, AppSettings)
- Removing fields from types
- Changing field types or nullability
- Adding new data entities
- Modifying nested structures

### CRUD Operations
- **Create**: Adding new projects, tasks, sections, dependencies
- **Read**: Loading data from storage, deserializing shared URLs
- **Update**: Modifying existing entities
- **Delete**: Removing entities, cascading deletions

### Data Flow Operations
- **Export**: Serializing data to JSON files
- **Import**: Deserializing data from JSON files
- **Share**: Compressing and encoding data for URLs
- **Load Shared**: Decompressing and decoding data from URLs
- **Merge**: Combining datasets while handling duplicates
- **Deduplicate**: Removing duplicate entries

## Required Test Coverage

### 1. Data Integrity Tests (`lib/share/dataIntegrity.test.ts`)

**MUST test ALL of the following:**

#### Export to JSON
- ✅ All data fields are exported correctly
- ✅ Special characters are preserved (`<>&"'`)
- ✅ Unicode characters are preserved (中文, emoji 🎉)
- ✅ Null values are preserved
- ✅ Empty arrays are preserved
- ✅ Boolean values are preserved (true/false)
- ✅ Nested objects are preserved
- ✅ Timestamps are preserved (ISO format)
- ✅ Metadata is added (exportedAt, version)

#### Import from JSON
- ✅ All data fields are imported correctly
- ✅ Data structure is validated
- ✅ Invalid JSON is rejected
- ✅ Incomplete data structure is rejected
- ✅ Type validation works correctly

#### Round-trip: Export → Import
- ✅ Data survives export/import cycle
- ✅ Multiple cycles preserve data (test 5+ cycles)
- ✅ No data loss or corruption
- ✅ Field order doesn't matter

#### Share URL: Serialize → Compress → Encode → Decode → Decompress
- ✅ Data survives full share cycle
- ✅ Base64url encoding is URL-safe (no +, /, =)
- ✅ Signed/unsigned byte conversion works
- ✅ Edge case byte values (-128 to 127)
- ✅ Large datasets compress correctly
- ✅ Empty datasets are handled

#### Data Loss Detection
- ✅ Missing projects are detected
- ✅ Missing tasks are detected
- ✅ Missing sections are detected
- ✅ Missing dependencies are detected
- ✅ Missing TMS state is detected
- ✅ Missing settings are detected
- ✅ Missing nested fields are detected

#### Empty State Handling
- ✅ Empty arrays export correctly
- ✅ Empty arrays import correctly
- ✅ Null values in all nullable fields
- ✅ Default values are applied correctly

### 2. Share Service Tests (`lib/share/shareService.test.ts`)

**MUST test:**

- ✅ URL generation with current state
- ✅ URL loading and decompression
- ✅ Error handling for invalid URLs
- ✅ Error handling for corrupted data
- ✅ Clipboard operations
- ✅ URL length warnings (2000, 8000 chars)
- ✅ Hash extraction from URL
- ✅ State validation

### 3. Storage Tests (`lib/storage.test.ts`)

**MUST test:**

- ✅ Save to localStorage
- ✅ Load from localStorage
- ✅ Clear localStorage
- ✅ Export to JSON
- ✅ Import from JSON
- ✅ State validation
- ✅ Zustand store format compatibility
- ✅ Version migration (if applicable)

## Test Data Requirements

### Comprehensive Test State

Your test data MUST include:

```typescript
{
  // Multiple projects with various states
  projects: [
    { /* with special chars */ },
    { /* with unicode */ },
    { /* with empty fields */ },
    { /* with all fields populated */ }
  ],
  
  // Tasks covering all scenarios
  tasks: [
    { /* parent task */ },
    { /* subtask */ },
    { /* completed task */ },
    { /* task with no section */ },
    { /* task with all fields */ },
    { /* task with empty arrays */ },
    { /* task with null values */ }
  ],
  
  // Sections with different states
  sections: [
    { /* collapsed */ },
    { /* expanded */ },
    { /* different orders */ }
  ],
  
  // Dependencies
  dependencies: [
    { /* simple dependency */ },
    { /* chain dependency */ }
  ],
  
  // TMS state with all systems
  tmsState: {
    activeSystem: /* ... */,
    dit: { /* populated */ },
    af4: { /* populated */ },
    fvp: { /* populated */ }
  },
  
  // Settings with all options
  settings: {
    activeProjectId: /* ... */,
    timeManagementSystem: /* ... */,
    showOnlyActionableTasks: /* ... */,
    theme: /* ... */
  }
}
```

### Edge Cases to Test

1. **Special Characters**: `<>&"'\n\t\r`
2. **Unicode**: Chinese (中文), Japanese (日本語), Emoji (🎉🌍)
3. **Null Values**: All nullable fields
4. **Empty Arrays**: tags, todayTasks, markedTasks, etc.
5. **Empty Strings**: notes, assignee, description
6. **Boolean Values**: true, false
7. **Numbers**: 0, negative, large numbers
8. **Dates**: ISO format, edge dates
9. **IDs**: UUIDs, short IDs, special chars in IDs
10. **Nested Objects**: Deep nesting, empty objects

## When to Update Tests

### Always Update Tests When:

1. **Adding a new field** to any type
   - Add test data with the new field
   - Verify export includes the field
   - Verify import preserves the field
   - Test null/undefined/default values

2. **Removing a field** from any type
   - Update test data to remove the field
   - Verify old data with the field still imports (backward compatibility)
   - Add migration test if needed

3. **Changing field type**
   - Test old format → new format conversion
   - Test validation rejects invalid types
   - Add migration test

4. **Adding new data entity** (e.g., new array in AppState)
   - Add to test state
   - Test export/import
   - Test empty array handling
   - Test deduplication

5. **Modifying CRUD operations**
   - Test the operation preserves all data
   - Test cascading effects (e.g., delete project → delete tasks)
   - Test undo/redo if applicable

6. **Changing serialization logic**
   - Test backward compatibility
   - Test forward compatibility
   - Test migration path

## Test Execution

### Before Committing

```bash
# Run all data integrity tests
npm test -- lib/share/dataIntegrity.test.ts --run

# Run share service tests
npm test -- lib/share/shareService.test.ts --run

# Run storage tests
npm test -- lib/storage.test.ts --run

# Run all tests
npm test --run
```

### All Tests Must Pass

- ❌ **DO NOT** commit if any test fails
- ❌ **DO NOT** skip failing tests
- ❌ **DO NOT** comment out failing tests
- ✅ **FIX** the code or update the test appropriately

## Test Maintenance

### Keep Tests Comprehensive

- Add new test cases for each bug found
- Add tests for each edge case discovered
- Keep test data realistic and varied
- Document why each test exists

### Test Coverage Goals

- **Export/Import**: 100% of fields tested
- **Share URL**: 100% of data flow tested
- **Edge Cases**: All known edge cases covered
- **Error Handling**: All error paths tested

## Example: Adding a New Field

```typescript
// 1. Add field to type
interface Project {
  id: string;
  name: string;
  color?: string;  // ← NEW FIELD
}

// 2. Update test data
const testState = {
  projects: [
    { id: '1', name: 'A', color: '#ff0000' },  // ← With value
    { id: '2', name: 'B', color: null },       // ← Null
    { id: '3', name: 'C' }                     // ← Undefined
  ]
};

// 3. Add specific tests
it('should preserve project color field', () => {
  const exported = storage.exportToJSON();
  const imported = storage.importFromJSON(exported);
  
  expect(imported.projects[0].color).toBe('#ff0000');
  expect(imported.projects[1].color).toBeNull();
  expect(imported.projects[2].color).toBeUndefined();
});

// 4. Verify in round-trip test
it('should survive export/import cycle', () => {
  // This test should automatically cover the new field
  // if test data is comprehensive
});
```

## Consequences of Skipping Tests

### What Can Go Wrong:

1. **Data Loss**: Users lose their projects/tasks
2. **Corruption**: Data becomes unreadable
3. **Share Failures**: URLs don't work
4. **Import Failures**: Can't load backups
5. **Migration Issues**: Old data can't be loaded
6. **Silent Failures**: Data appears to work but is incomplete

### Real Example:

```
User creates project with new field
  ↓
Shares URL
  ↓
New field not included in export (BUG - no test caught this)
  ↓
Friend loads URL
  ↓
New field is missing
  ↓
Data is incomplete
  ↓
User loses data
```

## Summary

**Golden Rule**: If it touches data, it must have comprehensive tests.

**Test Checklist**:
- [ ] Export includes all fields
- [ ] Import preserves all fields
- [ ] Round-trip works (5+ cycles)
- [ ] Share URL works
- [ ] Special characters preserved
- [ ] Unicode preserved
- [ ] Null values preserved
- [ ] Empty arrays preserved
- [ ] Edge cases covered
- [ ] Error handling tested
- [ ] All tests pass

**Remember**: Data integrity tests are not optional. They protect users from data loss.
