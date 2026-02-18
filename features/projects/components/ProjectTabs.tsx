'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface ProjectTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  enabledRuleCount?: number;
  children: {
    overview: React.ReactNode;
    list: React.ReactNode;
    board: React.ReactNode;
    calendar: React.ReactNode;
    automations: React.ReactNode;
  };
}

export function ProjectTabs({ activeTab, onTabChange, enabledRuleCount, children }: ProjectTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col">
      <TabsList className="w-full justify-start flex-shrink-0 sticky top-0 bg-background z-10">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="board">Board</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="automations" className="gap-2">
          <Zap className="h-4 w-4" />
          Automations
          {enabledRuleCount !== undefined && enabledRuleCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
              {enabledRuleCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="flex-1 overflow-auto mt-4">
        {children.overview}
      </TabsContent>
      
      <TabsContent value="list" className="flex-1 overflow-auto mt-4">
        {children.list}
      </TabsContent>
      
      <TabsContent value="board" className="flex-1 overflow-auto mt-4">
        {children.board}
      </TabsContent>
      
      <TabsContent value="calendar" className="flex-1 overflow-auto mt-4">
        {children.calendar}
      </TabsContent>
      
      <TabsContent value="automations" className="flex-1 overflow-auto mt-4">
        {children.automations}
      </TabsContent>
    </Tabs>
  );
}
