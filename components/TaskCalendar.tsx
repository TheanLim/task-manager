'use client';

import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { useState } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { InlineEditable } from '@/components/InlineEditable';
import { validateTaskDescription } from '@/lib/validation';
import { useDataStore } from '@/stores/dataStore';

interface TaskCalendarProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

export function TaskCalendar({ tasks, onTaskClick, onTaskComplete }: TaskCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const { updateTask } = useDataStore();

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => 
      task.dueDate && isSameDay(new Date(task.dueDate), date)
    );
  };

  // Get tasks without due dates
  const tasksWithoutDueDate = tasks.filter(task => !task.dueDate);

  // Get tasks for selected date
  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  // Get all dates in current month with tasks
  const datesWithTasks = new Set(
    tasks
      .filter(task => task.dueDate)
      .map(task => format(new Date(task.dueDate!), 'yyyy-MM-dd'))
  );

  const renderTaskCard = (task: Task) => (
    <Card
      key={task.id}
      className="p-3 cursor-pointer transition-colors hover:bg-accent mb-2"
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => {
            onTaskComplete(task.id, checked === true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
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
          
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {task.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-md"
            modifiers={{
              hasTasks: (date) => datesWithTasks.has(format(date, 'yyyy-MM-dd'))
            }}
            modifiersStyles={{
              hasTasks: {
                fontWeight: 'bold',
                textDecoration: 'underline',
              }
            }}
          />
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Dates with tasks are <strong className="underline">underlined</strong></p>
          </div>
        </Card>
      </div>

      {/* Tasks for selected date */}
      <div className="space-y-6">
        {selectedDate && (
          <div>
            <h3 className="text-lg font-semibold mb-3">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            
            {selectedDateTasks.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  No tasks scheduled for this date
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {selectedDateTasks.map(task => renderTaskCard(task))}
              </div>
            )}
          </div>
        )}

        {/* Tasks without due date */}
        {tasksWithoutDueDate.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">
              No Due Date
              <Badge variant="outline" className="ml-2">
                {tasksWithoutDueDate.length}
              </Badge>
            </h3>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {tasksWithoutDueDate.map(task => renderTaskCard(task))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
