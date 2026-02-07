'use client';

import { Task, Section, Priority } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar, GripVertical, Plus } from 'lucide-react';
import { format } from 'date-fns';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription, validateSectionName } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { v4 as uuidv4 } from 'uuid';

interface TaskBoardProps {
  tasks: Task[];
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onTaskMove: (taskId: string, sectionId: string) => void;
  onAddTask: (sectionId: string) => void;
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
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {children}
      </div>
    </div>
  );
}

// Draggable task card component
function DraggableTaskCard({ task, children }: { task: Task; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function TaskBoard({ tasks, sections, onTaskClick, onTaskComplete, onTaskMove, onAddTask }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'section' | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const { updateTask, updateSection, deleteSection, addSection } = useDataStore();

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    if (activeType === 'task') {
      // Handle task drag
      const taskId = active.id as string;
      const sectionId = over.id as string;
      onTaskMove(taskId, sectionId);
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

    const newSection = {
      id: uuidv4(),
      projectId,
      name: newSectionName.trim(),
      order: sections.length,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addSection(newSection);
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleCancelAddSection = () => {
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const getTasksBySection = (sectionId: string) => {
    return tasks.filter(task => task.sectionId === sectionId);
  };

  const renderTaskCard = (task: Task) => (
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
        
        {/* Second row: due date and tags */}
        {(task.dueDate || task.tags.length > 0) && (
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
          </div>
        )}
      </div>
    </Card>
  );

  const activeTask = activeId && activeType === 'task' ? tasks.find(t => t.id === activeId) : null;
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sectionIds = sortedSections.map(s => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sectionIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedSections.map(section => {
            const sectionTasks = getTasksBySection(section.id);
            
            return (
              <SortableSection key={section.id} id={section.id}>
                <DroppableSection id={section.id}>
                  <div className="bg-muted/50 rounded-lg p-4 min-h-[500px] flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex items-center justify-between flex-1">
                        <InlineEditable
                          value={section.name}
                          onSave={(newName) => updateSection(section.id, { name: newName })}
                          validate={validateSectionName}
                          placeholder="Section name"
                          displayClassName="font-semibold"
                          inputClassName="font-semibold"
                        />
                        <Badge variant="secondary">{sectionTasks.length}</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2 flex-1">
                      {sectionTasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No tasks in this section
                        </div>
                      ) : (
                        sectionTasks.map(task => (
                          <DraggableTaskCard key={task.id} task={task}>
                            {renderTaskCard(task)}
                          </DraggableTaskCard>
                        ))
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
            <div className="bg-muted/50 rounded-lg p-4 min-h-[500px] flex flex-col">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') handleCancelAddSection();
                }}
                placeholder="Section name"
                autoFocus
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddSection} disabled={!newSectionName.trim()} size="sm" className="flex-1">
                  Add
                </Button>
                <Button variant="ghost" onClick={handleCancelAddSection} size="sm" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-full min-h-[500px] border-dashed"
              onClick={() => setIsAddingSection(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add section
            </Button>
          )}
        </div>
      </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <Card className="p-3 opacity-90 shadow-lg rotate-3 w-[280px]">
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
