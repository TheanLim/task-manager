'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';

interface TMSEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function TMSEmptyState({ icon, title, description, action }: TMSEmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
      >
        {icon}
      </motion.div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
