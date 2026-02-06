# Specification Updates: Project Routing Feature

**Date**: 2026-02-01  
**Feature**: Project Routing with Query Parameters  
**Status**: Specification Complete, Ready for Implementation

## Summary

Added project routing functionality to enable shareable URLs for individual projects while maintaining static export compatibility. The implementation uses query parameter routing (`/?project=<id>`) as the optimal solution for static hosting.

## Changes Made

### 1. Requirements Document (`requirements.md`)

**Added: Requirement 19 - Project Routing**

New user story and 7 acceptance criteria covering:
- URL updates when selecting projects
- Direct navigation to projects via URL
- Project list display at root URL
- Browser back/forward navigation
- URL sharing functionality
- Invalid project ID handling
- Query parameter routing approach

**Location**: After Requirement 17 (Static Export Compatibility), before Requirement 18 (Future Extensibility)

### 2. Design Document (`design.md`)

**Added: Project Routing Architecture Section**

New design section covering:
- Design decision rationale (query parameters for static export)
- URL structure (`/` for list, `/?project=<id>` for projects)
- Implementation approach with code examples
- Navigation flow (5 steps from click to share)
- Error handling strategy
- Benefits and trade-offs analysis

**Location**: After "View Mode and Time Management System Interaction" section

**Key Design Decisions**:
- Query parameter routing chosen over dynamic routes or hash routing
- No additional dependencies required (uses Next.js built-in hooks)
- Simple implementation (~50 lines of code)
- Graceful error handling for invalid project IDs

### 3. Tasks Document (`tasks.md`)

**Added: Task 26 - Implement Project Routing with Query Parameters**

New implementation task with:
- 9 implementation steps
- Optional subtask 26.1 for unit tests (3 test scenarios)
- Requirements traceability (19.1-19.7)

**Renumbered**: Tasks 26-30 → Tasks 27-31 to accommodate new task

**Location**: After Task 25 (Configure Static Export), before Checkpoint

## Implementation Approach

### Technology Choice: Query Parameters

**Selected**: Option 3 from PROJECT_ROUTING_PROPOSAL.md

**Rationale**:
1. ✅ Works with static export (no server required)
2. ✅ No additional dependencies
3. ✅ Simplest implementation
4. ✅ Shareable URLs
5. ✅ Browser navigation support

**Rejected Alternatives**:
- Dynamic routes: Incompatible with static export
- Hash routing: Requires react-router-dom dependency, less clean URLs

### Implementation Steps

1. Update `app/page.tsx`:
   - Import `useSearchParams` and `useRouter` from 'next/navigation'
   - Read `project` query parameter
   - Conditionally render project list or project view
   - Handle invalid project IDs with redirect

2. Update `components/ProjectList.tsx`:
   - Use `router.push(\`/?project=\${id}\`)` for navigation
   - Remove direct state updates for project selection

3. Test:
   - URL updates on project selection
   - Direct navigation to project URLs
   - Browser back/forward buttons
   - Invalid project ID handling
   - URL sharing

4. Update documentation:
   - Add routing information to README.md
   - Document URL structure
   - Add examples of shareable URLs

## Requirements Traceability

### New Requirement Coverage

**Requirement 19: Project Routing**
- 19.1: URL updates with project ID → Task 26
- 19.2: Navigate to URL shows project → Task 26
- 19.3: Root URL shows project list → Task 26
- 19.4: Browser navigation works → Task 26
- 19.5: Shareable URLs work → Task 26
- 19.6: Invalid ID redirects → Task 26
- 19.7: Query parameter routing → Task 26

### Related Requirements

**Requirement 17: Static Export Compatibility**
- 17.3: Client-side routing compatible with static hosting → Satisfied by query parameters

## Testing Strategy

### Unit Tests (Task 26.1 - Optional)

1. **Test: Project list displays when no query parameter**
   - Navigate to `/`
   - Verify project list is rendered
   - Verify no project view is shown

2. **Test: Project view displays with valid project ID**
   - Navigate to `/?project=<valid-id>`
   - Verify project view is rendered
   - Verify correct project data is displayed

3. **Test: Redirect to list with invalid project ID**
   - Navigate to `/?project=<invalid-id>`
   - Verify redirect to `/`
   - Verify project list is displayed

4. **Test: Browser navigation (back/forward)**
   - Navigate from list to project
   - Click browser back button
   - Verify return to project list
   - Click browser forward button
   - Verify return to project view

### Manual Testing Checklist

- [ ] Click project in list → URL updates
- [ ] Copy URL → Paste in new tab → Same project loads
- [ ] Browser back button → Returns to list
- [ ] Browser forward button → Returns to project
- [ ] Invalid project ID in URL → Redirects to list
- [ ] Bookmark project URL → Bookmark works
- [ ] Share URL with another user → URL works

## Documentation Updates Required

### README.md
- Add "URL Structure" section
- Document query parameter routing
- Provide examples of shareable URLs
- Explain browser navigation support

### QUICK_START.md
- Add note about shareable project URLs
- Show example of copying project URL
- Mention browser back/forward support

## Next Steps

1. ✅ **COMPLETE**: Update specification documents (requirements, design, tasks)
2. **TODO**: Implement Task 26 - Project Routing
3. **TODO**: Test implementation manually
4. **TODO**: Update documentation (README, QUICK_START)
5. **TODO**: Run full test suite
6. **TODO**: Verify static export still works

## Notes

- This feature maintains backward compatibility (no breaking changes)
- Static export requirement is preserved
- No new dependencies added
- Implementation estimated at ~1 hour
- Simple rollback if issues arise (revert single commit)

## References

- PROJECT_ROUTING_PROPOSAL.md - Original proposal with 3 options
- requirements.md - Requirement 19
- design.md - Project Routing Architecture section
- tasks.md - Task 26
