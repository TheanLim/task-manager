# Specification Changelog

## 2024-01-31 - DIT Drag-and-Drop Enhancement

### Summary
Added requirements, design, and tasks for implementing drag-and-drop functionality in the DIT (Do It Tomorrow) view, along with scrollable sections for better UX when dealing with many tasks.

### Changes Made

#### Requirements Document (`requirements.md`)
**Updated Requirement 7: Do It Tomorrow (DIT) Time Management System**

Added 7 new acceptance criteria:
- **7.6**: Drag task from Tomorrow to Today
- **7.7**: Drag task from Today to Tomorrow (bidirectional)
- **7.8**: Drag unscheduled tasks to Today or Tomorrow
- **7.9**: Scrollable sections when > 10 tasks (max-height: 400px)
- **7.10**: Visual feedback (drag preview, drop zone highlighting)
- **7.11**: Touch support for mobile devices
- **7.12**: Keyboard accessibility maintained (arrow buttons)

#### Design Document (`design.md`)
**Added DIT Drag-and-Drop Design Section**

New design specifications:
- **Droppable zones**: today, tomorrow, unscheduled
- **Store actions**: moveToToday, moveToTomorrow, removeFromSchedule
- **Visual feedback**: drag overlay, drop zone highlight, optional drag handle
- **Accessibility**: keyboard support, screen reader announcements, touch support
- **Scrollable sections**: 400px max height, 10 task threshold, smooth scroll

#### Tasks Document (`tasks.md`)
**Added Task 17.6: Enhance DIT View with Drag-and-Drop**

New implementation tasks:
- **17.6.1**: Add missing TMS store actions (moveToTomorrow, removeFromSchedule)
- **17.6.2**: Install and configure @dnd-kit library
- **17.6.3**: Implement drag-and-drop functionality with visual feedback
- **17.6.4**: Add scrollable sections with max-height
- **17.6.5**: Maintain accessibility (keyboard, screen readers)
- **17.6.6**: Write tests for new functionality

### Technical Approach

**Library Choice**: @dnd-kit/core
- Modern, accessible drag-and-drop library
- Built-in touch support
- Keyboard navigation support
- Lightweight and performant
- Active maintenance

**Implementation Strategy**:
1. Add missing store actions first (foundation)
2. Install and configure drag-and-drop library
3. Implement drag-and-drop with visual feedback
4. Add scrollable sections for scalability
5. Ensure accessibility is maintained
6. Write comprehensive tests

**UX Improvements**:
- **Bidirectional movement**: Tasks can move both ways (Today ↔ Tomorrow)
- **Unscheduled tasks**: Can be dragged to either section
- **Scrollable sections**: Prevents visual overwhelm with many tasks
- **Visual feedback**: Clear indication of drag state and drop zones
- **Accessibility**: Arrow buttons remain as keyboard alternative

### Dependencies

**New npm packages required**:
```json
{
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

### Estimated Effort

| Task | Complexity | Time Estimate |
|------|-----------|---------------|
| 17.6.1 - Store actions | Low | 30 minutes |
| 17.6.2 - Library setup | Low | 30 minutes |
| 17.6.3 - Drag-and-drop | Medium | 2-3 hours |
| 17.6.4 - Scrollable sections | Low | 30 minutes |
| 17.6.5 - Accessibility | Low | 1 hour |
| 17.6.6 - Tests | Medium | 1-2 hours |
| **Total** | | **5-7 hours** |

### Benefits

1. **Better UX**: More intuitive task movement with drag-and-drop
2. **Scalability**: Scrollable sections handle large task lists
3. **Flexibility**: Bidirectional movement and unscheduled task support
4. **Accessibility**: Maintains keyboard and screen reader support
5. **Mobile-friendly**: Touch support for tablets and phones

### Next Steps

1. Review and approve specification changes
2. Install @dnd-kit dependencies
3. Implement tasks in order (17.6.1 → 17.6.6)
4. Test thoroughly on desktop, mobile, and with assistive technologies
5. Update documentation (README, QUICK_START) with drag-and-drop usage

