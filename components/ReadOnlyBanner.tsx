import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadOnlyBannerProps {
  /**
   * Callback function invoked when the user clicks the "Take control" button
   */
  onTakeControl: () => void;
  /**
   * Optional additional CSS classes
   */
  className?: string;
}

/**
 * ReadOnlyBanner component
 * 
 * Displays a prominent banner indicating that the current tab is in read-only mode
 * because another tab is active. Provides a "Take control" button to allow the user
 * to force this tab to become active.
 * 
 * Requirements: 7.1, 8.1, 8.2
 */
export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  onTakeControl,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Read-only mode - another tab is active
        </p>
      </div>
      <Button
        onClick={onTakeControl}
        variant="outline"
        size="sm"
        className="bg-white dark:bg-gray-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700"
      >
        Take control
      </Button>
    </div>
  );
};
