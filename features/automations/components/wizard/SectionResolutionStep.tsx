'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SectionResolutionStepProps {
  triggerSection: { id: string; name: string } | null;
  actionSection: { id: string; name: string } | null;
  sourceProjectName: string;
  onChange: (updates: { triggerResolution: 'by_name' | 'source_project_only'; actionResolution: 'by_name' | 'source_project_only' }) => void;
}

export function SectionResolutionStep({
  triggerSection,
  actionSection,
  sourceProjectName,
  onChange,
}: SectionResolutionStepProps) {
  const handleTriggerResolutionChange = (value: string) => {
    onChange({
      triggerResolution: value as 'by_name' | 'source_project_only',
      actionResolution: actionSection ? 'by_name' : 'by_name',
    });
  };

  const handleActionResolutionChange = (value: string) => {
    onChange({
      triggerResolution: triggerSection ? 'by_name' : 'by_name',
      actionResolution: value as 'by_name' | 'source_project_only',
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When promoting this rule to global scope, choose how section IDs resolve:
        </p>

        {/* Trigger Section */}
        {triggerSection && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trigger section: "{triggerSection.name}"</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value="by_name"
                onValueChange={handleTriggerResolutionChange}
                className="space-y-3"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="by_name"
                    id="trigger-by-name"
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="trigger-by-name" className="text-sm font-medium">
                      Match by name
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Find a section named '{triggerSection.name}' in each project at run time. Recommended.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="source_project_only"
                    id="trigger-source-only"
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="trigger-source-only" className="text-sm font-medium">
                      This project only
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Scope the rule to just '{sourceProjectName}'. The section ID will always resolve correctly.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Action Section */}
        {actionSection && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action section: "{actionSection.name}"</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value="by_name"
                onValueChange={handleActionResolutionChange}
                className="space-y-3"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="by_name"
                    id="action-by-name"
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="action-by-name" className="text-sm font-medium">
                      Match by name
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Find a section named '{actionSection.name}' in each project at run time. Recommended.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="source_project_only"
                    id="action-source-only"
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="action-source-only" className="text-sm font-medium">
                      This project only
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Scope the rule to just '{sourceProjectName}'. The section ID will always resolve correctly.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info note */}
      <div className="bg-muted/50 rounded-md px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          Projects without a matching section will skip this rule and log a 'section not found' entry.
        </p>
      </div>
    </div>
  );
}
