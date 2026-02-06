# View Mode Troubleshooting Guide

## Issue: View mode buttons don't change the view

### Quick Fix

If you're not seeing changes when clicking List/Board/Calendar buttons, try these steps:

### 1. Check Time Management System
**The view mode buttons only work in Standard mode (no TMS active).**

- Look at the "Time Management System" dropdown in the left sidebar
- If it shows "Do It Tomorrow (DIT)", "Autofocus 4 (AF4)", or "Final Version Perfected (FVP)", the view modes are disabled
- **Solution**: Select "None" from the Time Management System dropdown

**Why?** Time Management Systems (DIT, AF4, FVP) have their own specialized views that override the standard view modes.

### 2. Clear Browser Data (if using old projects)
If you created projects before the view modes were implemented, they might not have a `viewMode` property.

**Option A: Clear localStorage (loses all data)**
1. Open browser DevTools (F12)
2. Go to Application tab → Storage → Local Storage
3. Find your app's domain and click "Clear All"
4. Refresh the page
5. Create a new project

**Option B: Export, clear, and re-import**
1. Click "Data" → "Export Data" to backup
2. Clear localStorage (see Option A)
3. Click "Data" → "Import Data" and select your backup file
4. Projects will be migrated with default view mode (List)

### 3. Verify View Mode Buttons Are Visible
The view mode buttons should appear in the header when:
- ✅ A project is selected
- ✅ Time Management System is set to "None"
- ✅ Screen width is > 640px (hidden on mobile)

If you don't see the buttons:
- Check if you have a project selected
- Check if TMS is set to "None"
- Try on a larger screen or desktop

### 4. Check for Board View Requirements
**Board View requires columns to be set up.**

If you switch to Board View and see empty columns or errors:
1. Make sure your project has columns defined
2. Use the Column Manager to add columns (e.g., "To Do", "In Progress", "Done")
3. Assign tasks to columns

### 5. Check for Calendar View Requirements
**Calendar View shows tasks by due date.**

If Calendar View looks empty:
- Tasks without due dates appear in the "No Due Date" section (right side)
- Add due dates to tasks to see them on the calendar
- Click dates on the calendar to see tasks due that day

## Testing View Modes

### Test in Standard Mode
1. **Select "None"** from Time Management System dropdown
2. **Create a test project** (or select existing one)
3. **Look for view mode buttons** in the header (List/Board/Calendar icons)
4. **Click each button** and verify the view changes:
   - **List**: Tasks grouped by sections
   - **Board**: Kanban columns (requires columns setup)
   - **Calendar**: Monthly calendar with tasks by due date

### Expected Behavior
- Clicking "List" shows traditional task list
- Clicking "Board" shows kanban board with columns
- Clicking "Calendar" shows monthly calendar
- Active button is highlighted
- View preference is saved per project

## Still Not Working?

### Debug Steps
1. **Open browser console** (F12 → Console tab)
2. **Look for errors** when clicking view mode buttons
3. **Check network tab** for failed requests
4. **Verify localStorage** has your project data:
   ```javascript
   // In browser console:
   JSON.parse(localStorage.getItem('task-management-data'))
   ```

### Common Issues

**Issue**: Buttons visible but nothing happens when clicked
- **Cause**: Project might not have viewMode property
- **Fix**: Export data, clear localStorage, re-import

**Issue**: Board View shows "No tasks in this column"
- **Cause**: No columns set up or tasks not assigned to columns
- **Fix**: Use Column Manager to create columns, assign tasks

**Issue**: Calendar View is empty
- **Cause**: No tasks have due dates
- **Fix**: Add due dates to tasks, or check "No Due Date" section

**Issue**: View mode buttons not visible
- **Cause**: TMS is active (not "None")
- **Fix**: Switch TMS to "None"

## Need More Help?

1. Check the README.md for detailed view mode documentation
2. Check QUICK_START.md for usage examples
3. Review VIEW_MODES_IMPLEMENTATION.md for technical details
4. Open browser DevTools and check console for errors

## Quick Reference

| View Mode | Best For | Requirements |
|-----------|----------|--------------|
| **List** | Sequential work, detailed info | Sections (optional) |
| **Board** | Workflow visualization | Columns (required) |
| **Calendar** | Deadline management | Due dates (optional) |

**Remember**: View modes only work when Time Management System is set to "None"!
