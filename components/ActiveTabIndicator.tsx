import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveTabIndicatorProps {
  /**
   * Optional additional CSS classes
   */
  className?: string;
}

/**
 * ActiveTabIndicator component
 * 
 * Displays a subtle indicator confirming that the current tab is the active tab
 * with editing capabilities enabled. This provides visual feedback to the user
 * about their tab's status.
 * 
 * Requirements: 7.3
 */
export const ActiveTabIndicator: React.FC<ActiveTabIndicatorProps> = ({
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Badge
        variant="outline"
        className="bg-white dark:bg-gray-800 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Active tab
      </Badge>
    </div>
  );
};
