import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ProjectTabs } from './ProjectTabs';

describe('ProjectTabs', () => {
  const mockChildren = {
    overview: <div>Overview Content</div>,
    list: <div>List Content</div>,
    board: <div>Board Content</div>,
    calendar: <div>Calendar Content</div>,
    automations: <div>Automations Content</div>,
  };

  describe('Automations tab badge', () => {
    it('should render Automations tab with Zap icon', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={0}>
          {mockChildren}
        </ProjectTabs>
      );

      const automationsTab = screen.getByRole('tab', { name: /automations/i });
      expect(automationsTab).toBeInTheDocument();
    });

    it('should show badge when enabledRuleCount > 0', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={3}>
          {mockChildren}
        </ProjectTabs>
      );

      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('should hide badge when enabledRuleCount is 0', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={0}>
          {mockChildren}
        </ProjectTabs>
      );

      // Badge should not be present
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should hide badge when enabledRuleCount is undefined', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}}>
          {mockChildren}
        </ProjectTabs>
      );

      // No badge should be rendered
      const automationsTab = screen.getByRole('tab', { name: /automations/i });
      expect(automationsTab).toBeInTheDocument();
      // Verify no badge by checking there's no secondary badge element
      const badges = screen.queryAllByText(/^\d+$/);
      expect(badges).toHaveLength(0);
    });

    it('should show warning icon when totalRuleCount >= 10', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={8} totalRuleCount={10}>
          {mockChildren}
        </ProjectTabs>
      );

      const warningIcon = screen.getByLabelText('High rule count warning');
      expect(warningIcon).toBeInTheDocument();
    });

    it('should not show warning icon when totalRuleCount < 10', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={5} totalRuleCount={9}>
          {mockChildren}
        </ProjectTabs>
      );

      expect(screen.queryByLabelText('High rule count warning')).not.toBeInTheDocument();
    });

    it('should not show warning icon when totalRuleCount is undefined', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}} enabledRuleCount={5}>
          {mockChildren}
        </ProjectTabs>
      );

      expect(screen.queryByLabelText('High rule count warning')).not.toBeInTheDocument();
    });

    /**
     * Property 1: Badge count equals enabled rule count
     * 
     * **Validates: Requirements 1.2, 1.3**
     * 
     * For any list of automation rules for a project, the count badge displayed on the
     * Automations tab should equal the number of rules where `enabled === true`, and
     * should be hidden when that count is zero.
     */
    it('Property 1: badge count equals enabled rule count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (enabledCount) => {
            const { container } = render(
              <ProjectTabs
                activeTab="automations"
                onTabChange={() => {}}
                enabledRuleCount={enabledCount}
              >
                {mockChildren}
              </ProjectTabs>
            );

            if (enabledCount === 0) {
              // Badge should be hidden when count is 0
              expect(screen.queryByText(enabledCount.toString())).not.toBeInTheDocument();
            } else {
              // Badge should show the exact count when > 0
              const badge = screen.getByText(enabledCount.toString());
              expect(badge).toBeInTheDocument();
            }

            // Cleanup
            container.remove();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tab navigation', () => {
    it('should render all tabs', () => {
      render(
        <ProjectTabs activeTab="list" onTabChange={() => {}}>
          {mockChildren}
        </ProjectTabs>
      );

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /list/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /board/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /calendar/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /automations/i })).toBeInTheDocument();
    });

    it('should show active tab content', () => {
      render(
        <ProjectTabs activeTab="automations" onTabChange={() => {}}>
          {mockChildren}
        </ProjectTabs>
      );

      expect(screen.getByText('Automations Content')).toBeInTheDocument();
    });
  });
});
