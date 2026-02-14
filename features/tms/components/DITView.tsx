'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, GripVertical, Calendar } from 'lucide-react';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
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
} from '@dnd-kit/core';
import { useState } from 'react';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';

interface DITViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

// Droppable zone component
function DroppableZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors rounded-lg p-4 ${
        isOver ? 'bg-accent/50 ring-2 ring-primary' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Draggable task component
function DraggableTask({ task, children }: { task: Task; children: React.ReactNode }) {
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

export function DITView({ tasks, onTaskClick, onTaskComplete }: DITViewProps) {
  const { state, moveToToday, moveToTomorrow, removeFromSchedule } = useTMSStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { updateTask } = useDataStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const todayTasks = tasks.filter(t => state.dit.todayTasks.includes(t.id));
  const tomorrowTasks = tasks.filter(t => state.dit.tomorrowTasks.includes(t.id));
  const unscheduledTasks = tasks.filter(
    t => !state.dit.todayTasks.includes(t.id) && !state.dit.tomorrowTasks.includes(t.id)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const taskId = active.id as string;
    const dropZone = over.id as string;

    // Determine current location of the task
    const isInToday = state.dit.todayTasks.includes(taskId);
    const isInTomorrow = state.dit.tomorrowTasks.includes(taskId);

    // Handle drop based on zone
    if (dropZone === 'today' && !isInToday) {
      moveToToday(taskId);
    } else if (dropZone === 'tomorrow' && !isInTomorrow) {
      moveToTomorrow(taskId);
    } else if (dropZone === 'unscheduled' && (isInToday || isInTomorrow)) {
      removeFromSchedule(taskId);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const renderTask = (task: Task, showMoveToTodayButton = false, showMoveToTomorrowButton = false) => (
    <Card
      key={task.id}
      id={task.id}
      className="p-3 cursor-pointer transition-colors hover:bg-accent"
    >
      <div className="flex items-start gap-3">
        <div
          className="cursor-grab active:cursor-grabbing mt-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => {
            onTaskComplete(task.id, checked === true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 min-w-0" onClick={() => onTaskClick(task.id)}>
              <InlineEditable
                value={task.description}
                onSave={(newDescription) => updateTask(task.id, { description: newDescription })}
                validate={validateTaskDescription}
                placeholder="Task description"
                displayClassName={task.completed ? 'line-through text-muted-foreground' : ''}
                inputClassName="w-full"
              />
            </div>
            {task.priority !== 'none' && (
              <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                {task.priority}
              </Badge>
            )}
          </div>
          
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), 'MMM d')}</span>
            </div>
          )}
        </div>

        {showMoveToTodayButton && !task.completed && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              moveToToday(task.id);
            }}
            aria-label="Move to Today"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        
        {showMoveToTomorrowButton && !task.completed && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              moveToTomorrow(task.id);
            }}
            aria-label="Move to Tomorrow"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6">
        {/* Today Section */}
        <DroppableZone id="today">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Today</h3>
            <Badge variant="default">{todayTasks.length} tasks</Badge>
          </div>
          
          {todayTasks.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                No tasks scheduled for today. Move tasks from tomorrow or add new ones.
              </p>
            </Card>
          ) : (
            <div 
              className={`space-y-2 ${todayTasks.length > 10 ? 'max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-900' : ''}`}
            >
              {todayTasks.map(task => (
                <DraggableTask key={task.id} task={task}>
                  {renderTask(task, false, true)}
                </DraggableTask>
              ))}
            </div>
          )}
        </DroppableZone>

        {/* Tomorrow Section */}
        <DroppableZone id="tomorrow">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tomorrow</h3>
            <Badge variant="secondary">{tomorrowTasks.length} tasks</Badge>
          </div>
          
          {tomorrowTasks.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                No tasks scheduled for tomorrow. New tasks are automatically added here.
              </p>
            </Card>
          ) : (
            <div 
              className={`space-y-2 ${tomorrowTasks.length > 10 ? 'max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-900' : ''}`}
            >
              {tomorrowTasks.map(task => (
                <DraggableTask key={task.id} task={task}>
                  {renderTask(task, true, false)}
                </DraggableTask>
              ))}
            </div>
          )}
        </DroppableZone>

        {/* Unscheduled Section */}
        {unscheduledTasks.length > 0 && (
          <DroppableZone id="unscheduled">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Unscheduled</h3>
              <Badge variant="outline">{unscheduledTasks.length} tasks</Badge>
            </div>
            
            <div className="space-y-2">
              {unscheduledTasks.map(task => (
                <DraggableTask key={task.id} task={task}>
                  {renderTask(task, false, false)}
                </DraggableTask>
              ))}
            </div>
          </DroppableZone>
        )}
      </div>

      <DragOverlay>
        {activeTask ? (
          <Card className="p-3 opacity-90 shadow-lg rotate-3">
            <div className="flex items-start gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
              <Checkbox checked={activeTask.completed} disabled />
              <div className="flex-1 min-w-0">
                <span className={activeTask.completed ? 'line-through text-muted-foreground' : ''}>
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
