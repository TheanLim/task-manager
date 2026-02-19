'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, List, Columns3, Calendar, Zap, AlertTriangle } from 'lucide-react';

interface ProjectTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  enabledRuleCount?: number;
  totalRuleCount?: number;
  children: {
    overview: React.ReactNode;
    list: React.ReactNode;
    board: React.ReactNode;
    calendar: React.ReactNode;
    automations: React.ReactNode;
  };
}

export function ProjectTabs({ activeTab, onTabChange, enabledRuleCount, totalRuleCount, children }: ProjectTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col">
      <TabsList className="w-full justify-start flex-shrink-0 sticky top-0 bg-background z-10 overflow-x-auto">
        <TabsTrigger value="overview" className="gap-2 data-[state=active]:text-accent-brand">
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="list" className="gap-2 data-[state=active]:text-accent-brand">
          <List className="h-4 w-4" aria-hidden="true" />
          List
        </TabsTrigger>
        <TabsTrigger value="board" className="gap-2 data-[state=active]:text-accent-brand">
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          Board
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-2 data-[state=active]:text-accent-brand">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Calendar
        </TabsTrigger>
        <TabsTrigger value="automations" className="gap-2 data-[state=active]:text-accent-brand">
          <Zap className="h-4 w-4" aria-hidden="true" />
          Automations
          {enabledRuleCount !== undefined && enabledRuleCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
              {enabledRuleCount}
            </Badge>
          )}
          {totalRuleCount !== undefined && totalRuleCount >= 10 && (
            <AlertTriangle className="ml-1 h-3.5 w-3.5 text-amber-500" aria-label="High rule count warning" />
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
