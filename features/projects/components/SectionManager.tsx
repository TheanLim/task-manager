'use client';

import { useState } from 'react';
import { Section, UUID } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { v4 as uuidv4 } from 'uuid';

interface SectionManagerProps {
  projectId: UUID;
}

export function SectionManager({ projectId }: SectionManagerProps) {
  const { addSection, updateSection, deleteSection, getSectionsByProjectId } = useDataStore();
  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');

  const projectSections = getSectionsByProjectId(projectId);

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;

    const newSection: Section = {
      id: uuidv4(),
      projectId,
      name: newSectionName.trim(),
      order: projectSections.length,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addSection(newSection);
    setNewSectionName('');
  };

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditingName(section.name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) return;

    updateSection(editingId, { name: editingName.trim() });
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (sectionId: UUID) => {
    if (confirm('Are you sure you want to delete this section? Tasks in this section will be moved to the default section.')) {
      deleteSection(sectionId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sections</h3>
      </div>

      <div className="space-y-2">
        {projectSections.map((section) => (
          <Card key={section.id} className="p-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
              
              {editingId === section.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveEdit}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleStartEdit(section)}
                  >
                    {section.name}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New section name"
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddSection();
          }}
        />
        <Button onClick={handleAddSection}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>
    </div>
  );
}
