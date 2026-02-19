'use client';

import { Task, Section, Priority } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DatePickerPopover } from '@/features/tasks/components/DatePickerPopover';
import { Calendar, GripVertical, Plus, ListTree, ChevronDown, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription, validateSectionName } from '@/lib/validation';
import { useDataStore, sectionService } from '@/stores/dataStore';
import { SectionContextMenuItem } from '@/features/automations/components/SectionContextMenuItem';
import type { TriggerType } from '@/features/automations/types';

interface TaskBoardProps {
  tasks: Task[];
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onTaskMove: (taskId: string, sectionId: string) => void;
  onAddTask: (sectionId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  onOpenRuleDialog?: (prefill: { triggerType: TriggerType; sectionId: string }) => void;
}

// Droppable section component
function DroppableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] transition-colors rounded-lg ${
        isOver ? 'bg-accent/50 ring-2 ring-primary' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Sortable section component for reordering
function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex-shrink-0 w-[280px]">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        {children}
      </div>
    </div>
  );
}

// Draggable task card component with sortable support
function DraggableTaskCard({ task, children }: { task: Task; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="motion-safe:hover:scale-[1.01] motion-safe:transition-transform motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md" {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function TaskBoard({ tasks, sections, onTaskClick, onTaskComplete, onTaskMove, onAddTask, onAddSubtask, onOpenRuleDialog }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'section' | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const { updateTask, updateSection, deleteSection, getSubtasks } = useDataStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    
    // Determine if dragging a task or section
    const isTask = tasks.some(t => t.id === id);
    const isSection = sections.some(s => s.id === id);
    
    if (isTask) {
      setActiveType('task');
    } else if (isSection) {
      setActiveType('section');
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    // Only handle task reordering here
    const activeTask = tasks.find(t => t.id === active.id);
    const overTask = tasks.find(t => t.id === over.id);
    
    if (activeTask && overTask) {
      // Tasks being reordered within or across sections
      if (activeTask.sectionId !== overTask.sectionId) {
        // Moving to different section - update section immediately
        updateTask(activeTask.id, { sectionId: overTask.sectionId });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    if (activeType === 'task') {
      // Handle task reordering
      const activeTask = tasks.find(t => t.id === active.id);
      const overTask = tasks.find(t => t.id === over.id);
      
      if (activeTask && overTask) {
        const targetSectionId = overTask.sectionId;
        
        // Get all tasks in target section
        const sectionTasks = tasks
          .filter(t => t.sectionId === targetSectionId && !t.parentTaskId && t.id !== activeTask.id)
          .sort((a, b) => a.order - b.order);
        
        // Find where to insert
        const overIndex = sectionTasks.findIndex(t => t.id === over.id);
        
        if (overIndex !== -1) {
          // Insert at the position
          sectionTasks.splice(overIndex, 0, activeTask);
        } else {
          // Append to end
          sectionTasks.push(activeTask);
        }
        
        // Update task section and order
        updateTask(activeTask.id, { 
          sectionId: targetSectionId,
          order: overIndex !== -1 ? overIndex : sectionTasks.length - 1
        });
        
        // Update order for all tasks in section
        sectionTasks.forEach((task, index) => {
          if (task.id !== activeTask.id) {
            updateTask(task.id, { order: index });
          }
        });
      } else if (activeTask && !overTask) {
        // Dropped on section (not on a task)
        const sectionId = over.id as string;
        const section = sections.find(s => s.id === sectionId);
        
        if (section) {
          // Get tasks in target section
          const sectionTasks = tasks
            .filter(t => t.sectionId === sectionId && !t.parentTaskId)
            .sort((a, b) => a.order - b.order);
          
          // Place at end
          updateTask(activeTask.id, { 
            sectionId: sectionId,
            order: sectionTasks.length
          });
        }
      }
    } else if (activeType === 'section') {
      // Handle section reordering
      const draggedSectionId = active.id as string;
      const targetSectionId = over.id as string;
      
      if (draggedSectionId !== targetSectionId) {
        const sortedSections = [...sections].sort((a, b) => a.order - b.order);
        const draggedIndex = sortedSections.findIndex(s => s.id === draggedSectionId);
        const targetIndex = sortedSections.findIndex(s => s.id === targetSectionId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const reorderedSections = [...sortedSections];
          const [removed] = reorderedSections.splice(draggedIndex, 1);
          reorderedSections.splice(targetIndex, 0, removed);
          
          // Update order for all sections
          reorderedSections.forEach((section, index) => {
            updateSection(section.id, { order: index });
          });
        }
      }
    }
    
    setActiveId(null);
    setActiveType(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
  };

  const handleAddTask = (sectionId: string) => {
    onAddTask(sectionId);
  };

  const handleAddSection = () => {
    const projectId = sections[0]?.projectId;
    if (!projectId || !newSectionName.trim()) return;

    sectionService.createWithDefaults(newSectionName.trim(), projectId, sections.length);
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleCancelAddSection = () => {
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const getTasksBySection = (sectionId: string) => {
    return tasks
      .filter(task => task.sectionId === sectionId && !task.parentTaskId)
      .sort((a, b) => a.order - b.order);
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const renderTaskCard = (task: Task) => {
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    const isExpanded = expandedSubtasks.has(task.id);

    return (
      <Card
        key={task.id}
        className="p-3 cursor-pointer transition-colors hover:bg-accent mb-2"
      >
        <div className="space-y-2">
          {/* First row: drag handle, checkbox, task name, priority */}
          <div className="flex items-start gap-2">
            <div className="cursor-grab active:cursor-grabbing mt-0.5">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="mt-0.5">
              <Checkbox
                checked={task.completed}
                onCheckedChange={(checked) => {
                  onTaskComplete(task.id, checked === true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex-1 min-w-0" onClick={() => onTaskClick(task.id)}>
                <InlineEditable
                  value={task.description}
                  onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                  validate={validateTaskDescription}
                  placeholder="Task description"
                  displayClassName={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                  inputClassName="text-sm w-full"
                />
              </div>
              {task.priority !== Priority.NONE && (
                <Badge variant={task.priority === Priority.HIGH ? 'destructive' : 'secondary'} className="text-xs flex-shrink-0">
                  {task.priority}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Second row: due date, tags, and subtask button */}
          {(task.dueDate || task.tags.length > 0 || hasSubtasks) && (
            <div className="flex items-center gap-2 flex-wrap ml-10">
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                </div>
              )}
              
              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Subtask button */}
              {hasSubtasks && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSubtasks(task.id);
                  }}
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-0.5 ml-auto"
                >
                  <span>{subtasks.length}</span>
                  <ListTree className="h-3 w-3" />
                  <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              )}
            </div>
          )}

          {/* Expanded subtasks list */}
          {hasSubtasks && isExpanded && (
            <div className="border-t border-b mt-2 -mx-3">
              {subtasks.map(subtask => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 py-2 px-3 hover:bg-accent/50 border-b last:border-b-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(subtask.id);
                  }}
                >
                  <Checkbox
                    checked={subtask.completed}
                    onCheckedChange={(checked) => {
                      onTaskComplete(subtask.id, checked === true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <InlineEditable
                      value={subtask.description}
                      onSave={(newDescription) => updateTask(subtask.id, { description: newDescription })}
                      validate={validateTaskDescription}
                      placeholder="Subtask description"
                      displayClassName={`text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}
                      inputClassName="text-sm w-full"
                    />
                  </div>
                  <DatePickerPopover
                    value={subtask.dueDate}
                    onChange={(date) => updateTask(subtask.id, { dueDate: date })}
                    align="start"
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        {subtask.dueDate ? (
                          <span>{format(new Date(subtask.dueDate), 'MMM d')}</span>
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                      </Button>
                    }
                  />
                </div>
              ))}
              
              {/* Add subtask row */}
              {onAddSubtask && (
                <div
                  className="flex items-center gap-2 py-2 px-3 hover:bg-accent/50 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSubtask(task.id);
                  }}
                >
                  <Plus className="h-4 w-4 ml-5" />
                  <span className="text-sm">Add subtask...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const activeTask = activeId && activeType === 'task' ? tasks.find(t => t.id === activeId) : null;
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sectionIds = sortedSections.map(s => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sectionIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth scrollbar-none">
          {sortedSections.map(section => {
            const sectionTasks = getTasksBySection(section.id);
            
            return (
              <SortableSection key={section.id} id={section.id}>
                <DroppableSection id={section.id}>
                  <div className="bg-muted/50 rounded-lg p-4 h-[calc(100dvh-16rem)] flex flex-col">
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex items-center justify-between flex-1">
                        <InlineEditable
                          value={section.name}
                          onSave={(newName) => updateSection(section.id, { name: newName })}
                          validate={validateSectionName}
                          placeholder="Section name"
                          displayClassName="font-semibold hover:bg-accent/50 rounded px-1 -mx-1 transition-colors cursor-text"
                          inputClassName="font-semibold"
                        />
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary">{sectionTasks.length}</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => deleteSection(section.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete section
                              </DropdownMenuItem>
                              {onOpenRuleDialog && (
                                <>
                                  <DropdownMenuSeparator />
                                  <SectionContextMenuItem
                                    sectionId={section.id}
                                    projectId={section.projectId || ''}
                                    onOpenRuleDialog={onOpenRuleDialog}
                                  />
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                    
                    {/* Task list: scrollable area. 16rem offset = header(4rem) + tabs(3rem) + section header/footer(4rem) + padding(5rem) */}
                    <div className="overflow-y-auto flex-1 space-y-2 min-h-0 scrollbar-none" role="region" aria-label={`${section.name} tasks`} tabIndex={0}>
                      {sectionTasks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg text-muted-foreground text-sm min-h-[120px]">
                          Drop tasks here
                        </div>
                      ) : (
                        <SortableContext items={sectionTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {sectionTasks.map(task => (
                            <DraggableTaskCard key={task.id} task={task}>
                              {renderTaskCard(task)}
                            </DraggableTaskCard>
                          ))}
                        </SortableContext>
                      )}
                    </div>

                    {/* Add Task Button */}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground hover:text-foreground mt-2"
                      onClick={() => handleAddTask(section.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add task
                    </Button>
                  </div>
                </DroppableSection>
              </SortableSection>
            );
          })}

        {/* Add Section Button / Input */}
        <div className="flex-shrink-0 w-[280px]">
          {isAddingSection ? (
            <div className="bg-muted/50 rounded-lg p-4">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') handleCancelAddSection();
                }}
                onBlur={handleCancelAddSection}
                placeholder="Section name"
                autoFocus
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddSection} 
                  disabled={!newSectionName.trim()} 
                  size="sm" 
                  className="flex-1"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking button
                >
                  Add
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleCancelAddSection} 
                  size="sm" 
                  className="flex-1"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking button
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() => setIsAddingSection(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add section
              </Button>
            </div>
          )}
        </div>
      </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <Card className="p-3 opacity-90 shadow-lg motion-safe:rotate-3 w-[280px]">
            <div className="flex items-start gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
              <Checkbox checked={activeTask.completed} disabled />
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${activeTask.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {activeTask.description}
                </span>
              </div>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
