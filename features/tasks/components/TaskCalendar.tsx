'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';
import { ChevronLeft, ChevronRight, ListTree } from 'lucide-react';

interface TaskCalendarProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function TaskCalendar({ tasks, onTaskClick, onTaskComplete }: TaskCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const { updateTask, getSubtasks } = useDataStore();

  // Filter out subtasks - only show top-level tasks
  const topLevelTasks = tasks.filter(task => !task.parentTaskId);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    return topLevelTasks.filter(task => 
      task.dueDate && isSameDay(new Date(task.dueDate), date)
    );
  };

  // Get tasks without due dates
  const tasksWithoutDueDate = topLevelTasks.filter(task => !task.dueDate);

  // Generate calendar days
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderTaskInCell = (task: Task) => {
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    
    return (
      <div
        key={task.id}
        className="text-xs px-1 py-0.5 mb-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: task.completed ? 'rgb(34 197 94 / 0.3)' : 'rgb(59 130 246 / 0.3)',
          color: task.completed ? 'rgb(22 163 74)' : 'rgb(37 99 235)',
          border: task.completed ? '1px solid rgb(34 197 94 / 0.5)' : '1px solid rgb(59 130 246 / 0.5)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick(task.id);
        }}
        title={task.description}
      >
        {task.completed && '✓ '}
        {task.description}
        {hasSubtasks && (
          <span className="ml-1 opacity-70">
            {subtasks.length} <ListTree className="inline h-2.5 w-2.5" />
          </span>
        )}
      </div>
    );
  };

  const renderTaskCard = (task: Task) => {
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    
    return (
      <Card
        key={task.id}
        className="p-3 cursor-pointer transition-colors hover:bg-accent mb-2"
      >
        <div className="flex items-start gap-2">
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
                displayClassName={task.completed ? 'line-through text-muted-foreground' : ''}
                inputClassName="w-full"
              />
            </div>
            {task.priority !== 'none' && (
              <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="flex-shrink-0">
                {task.priority}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap mt-2 ml-7">
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {hasSubtasks && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <span>{subtasks.length}</span>
              <ListTree className="h-3 w-3" />
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-px bg-border">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div
              key={day}
              className="bg-muted p-2 text-center text-sm font-semibold"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            const dayTasks = getTasksForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
                className={`
                  bg-background p-2 min-h-[120px] border-border
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isTodayDate ? 'ring-2 ring-primary ring-inset' : ''}
                `}
              >
                <div className={`
                  text-sm font-medium mb-1
                  ${isTodayDate ? 'text-primary font-bold' : ''}
                `}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 overflow-y-auto max-h-[90px]">
                  {dayTasks.slice(0, 3).map(task => renderTaskInCell(task))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tasks without due date */}
      {tasksWithoutDueDate.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            No Due Date
            <Badge variant="outline" className="ml-2">
              {tasksWithoutDueDate.length}
            </Badge>
          </h3>
          
          <div className="space-y-2">
            {tasksWithoutDueDate.map(task => renderTaskCard(task))}
          </div>
        </div>
      )}
    </div>
  );
}
