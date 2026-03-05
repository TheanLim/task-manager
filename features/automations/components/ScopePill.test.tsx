import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ScopePill } from "./ScopePill"

const allProjects = [
  { id: "p1", name: "Project Alpha" },
  { id: "p2", name: "Project Beta" },
  { id: "p3", name: "Project Gamma" },
  { id: "p4", name: "Project Delta" },
  { id: "p5", name: "Project Epsilon" },
  { id: "p6", name: "Project Zeta" },
  { id: "p7", name: "Project Eta" },
  { id: "p8", name: "Project Theta" },
  { id: "p9", name: "Project Iota" },
  { id: "p10", name: "Project Kappa" },
  { id: "p11", name: "Project Lambda" },
  { id: "p12", name: "Project Mu" },
]

describe("ScopePill", () => {
  it("renders 'All Projects' with sky color scheme for scope: 'all'", () => {
    render(
      <ScopePill
        scope="all"
        selectedProjectIds={[]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    expect(screen.getByText("All Projects")).toBeInTheDocument()
    expect(
      screen.getByText("All Projects", { selector: "div" })
    ).toBeInTheDocument()
  })

  it("does not render tooltip for scope: 'all'", () => {
    render(
      <ScopePill
        scope="all"
        selectedProjectIds={[]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("renders 'N projects' with violet color scheme for scope: 'selected'", async () => {
    const user = userEvent.setup()
    const selectedIds = ["p1", "p2", "p3"]

    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={selectedIds}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    expect(screen.getByText("3 projects")).toBeInTheDocument()

    const badge = screen.getByRole("button", {
      name: "Scope: Selected. Applies to: Project Alpha, Project Beta, Project Gamma",
    })
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
  })

  it("renders 'All except N' with orange color scheme for scope: 'all_except'", async () => {
    const user = userEvent.setup()
    const excludedIds = ["p1", "p2"]

    render(
      <ScopePill
        scope="all_except"
        selectedProjectIds={[]}
        excludedProjectIds={excludedIds}
        allProjects={allProjects}
      />
    )

    expect(screen.getByText("All except 2")).toBeInTheDocument()

    const badge = screen.getByRole("button", {
      name: "Scope: All except. Excluded: Project Alpha, Project Beta",
    })
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
  })

  it("truncates tooltip to 10 items with '+N more' for scope: 'selected'", async () => {
    const user = userEvent.setup()
    const selectedIds = [
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"
    ]

    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={selectedIds}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    expect(screen.getByText("12 projects")).toBeInTheDocument()

    const badge = screen.getByRole("button", {
      name: "Scope: Selected. Applies to: Project Alpha, Project Beta, Project Gamma, Project Delta, Project Epsilon, Project Zeta, Project Eta, Project Theta, Project Iota, Project Kappa, Project Lambda, Project Mu",
    })
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
    const [tooltipContent] = screen.getAllByText("Project Alpha, Project Beta, Project Gamma, Project Delta, Project Epsilon, Project Zeta, Project Eta, Project Theta, Project Iota, Project Kappa +2 more")
    expect(tooltipContent.parentElement).toBeInTheDocument()
  })

  it("truncates tooltip to 10 items with '+N more' for scope: 'all_except'", async () => {
    const user = userEvent.setup()
    const excludedIds = [
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"
    ]

    render(
      <ScopePill
        scope="all_except"
        selectedProjectIds={[]}
        excludedProjectIds={excludedIds}
        allProjects={allProjects}
      />
    )

    expect(screen.getByText("All except 12")).toBeInTheDocument()

    const badge = screen.getByRole("button", {
      name: "Scope: All except. Excluded: Project Alpha, Project Beta, Project Gamma, Project Delta, Project Epsilon, Project Zeta, Project Eta, Project Theta, Project Iota, Project Kappa, Project Lambda, Project Mu",
    })
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
    const [tooltipContent] = screen.getAllByText("Project Alpha, Project Beta, Project Gamma, Project Delta, Project Epsilon, Project Zeta, Project Eta, Project Theta, Project Iota, Project Kappa +2 more")
    expect(tooltipContent.parentElement).toBeInTheDocument()
  })

  it("applies correct color classes for scope: 'all'", () => {
    render(
      <ScopePill
        scope="all"
        selectedProjectIds={[]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByText("All Projects", { selector: "div" })
    expect(badge).toHaveClass("bg-sky-50")
    expect(badge).toHaveClass("text-sky-700")
    expect(badge).toHaveClass("border-sky-200")
    expect(badge).toHaveClass("dark:bg-sky-950/50")
    expect(badge).toHaveClass("dark:text-sky-300")
    expect(badge).toHaveClass("dark:border-sky-800")
  })

  it("applies correct color classes for scope: 'selected'", () => {
    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={["p1"]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByRole("button")
    expect(badge).toHaveClass("bg-violet-50")
    expect(badge).toHaveClass("text-violet-700")
    expect(badge).toHaveClass("border-violet-200")
    expect(badge).toHaveClass("dark:bg-violet-950/50")
    expect(badge).toHaveClass("dark:text-violet-300")
    expect(badge).toHaveClass("dark:border-violet-800")
  })

  it("applies correct color classes for scope: 'all_except'", () => {
    render(
      <ScopePill
        scope="all_except"
        selectedProjectIds={[]}
        excludedProjectIds={["p1"]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByRole("button")
    expect(badge).toHaveClass("bg-orange-50")
    expect(badge).toHaveClass("text-orange-700")
    expect(badge).toHaveClass("border-orange-200")
    expect(badge).toHaveClass("dark:bg-orange-950/50")
    expect(badge).toHaveClass("dark:text-orange-300")
    expect(badge).toHaveClass("dark:border-orange-800")
  })

  it("uses cursor-default class for tooltip-enabled pills", () => {
    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={["p1"]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    expect(screen.getByRole("button")).toHaveClass("cursor-default")
  })

  it("tooltip opens on focus", async () => {
    const user = userEvent.setup()
    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={["p1"]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByRole("button")
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
  })

  it("tooltip content has max-w-xs class", async () => {
    const user = userEvent.setup()
    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={["p1"]}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByRole("button")
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
    const tooltipContent = screen.getByRole("tooltip").parentElement
    expect(tooltipContent).toHaveClass("max-w-xs")
  })

  it("tooltip content has max-h-32 overflow-y-auto for project list", async () => {
    const user = userEvent.setup()
    const selectedIds = [
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"
    ]

    render(
      <ScopePill
        scope="selected"
        selectedProjectIds={selectedIds}
        excludedProjectIds={[]}
        allProjects={allProjects}
      />
    )

    const badge = screen.getByRole("button")
    await user.tab()
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })
    const tooltipContent = screen.getByRole("tooltip").parentElement
    expect(tooltipContent).toHaveClass("max-w-xs")
    const projectList = tooltipContent.querySelector("div")
    expect(projectList).toHaveClass("max-h-32")
    expect(projectList).toHaveClass("overflow-y-auto")
  })
})
