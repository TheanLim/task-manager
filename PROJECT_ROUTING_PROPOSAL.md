# Project Routing Proposal

## Current State
- Single page app at `/`
- All projects on one page
- Project selection via sidebar
- No URL changes when switching projects

## Proposed: One Page Per Project

### Option 1: Dynamic Routes with Static Export ✅ (Recommended)

**Structure:**
```
app/
├── page.tsx                    # Home/project list
├── project/
│   └── [id]/
│       └── page.tsx           # Individual project page
```

**URLs:**
- `/` - Project list/dashboard
- `/project/abc-123` - Specific project page
- `/project/def-456` - Another project page

**Benefits:**
- ✅ Shareable URLs for specific projects
- ✅ Browser back/forward works
- ✅ Can bookmark specific projects
- ✅ Still works with static export
- ✅ Better for multi-tab workflows

**Implementation Steps:**

1. **Create dynamic route structure:**
```bash
mkdir -p app/project/[id]
```

2. **Create `app/project/[id]/page.tsx`:**
```typescript
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
// ... other imports

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const { projects, getProjectById } = useDataStore();
  const { setActiveProject } = useAppStore();
  
  const project = getProjectById(projectId);
  
  useEffect(() => {
    if (!project) {
      // Project not found, redirect to home
      router.push('/');
      return;
    }
    
    // Set as active project
    setActiveProject(projectId);
  }, [projectId, project, router, setActiveProject]);
  
  if (!project) {
    return <div>Loading...</div>;
  }
  
  // Render project view (same as current page.tsx but for single project)
  return (
    <Layout>
      {/* Project content */}
    </Layout>
  );
}
```

3. **Update `app/page.tsx` to be a project list:**
```typescript
export default function Home() {
  const { projects } = useDataStore();
  const router = useRouter();
  
  return (
    <Layout>
      <h1>Projects</h1>
      <div className="grid gap-4">
        {projects.map(project => (
          <Card 
            key={project.id}
            onClick={() => router.push(`/project/${project.id}`)}
            className="cursor-pointer hover:bg-accent"
          >
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
```

4. **Update navigation to use router:**
```typescript
// In ProjectList component
const handleProjectClick = (projectId: string) => {
  router.push(`/project/${projectId}`);
};
```

5. **Configure static export to generate all project pages:**
```typescript
// next.config.js
module.exports = {
  output: 'export',
  // This won't work for dynamic routes in static export!
  // See Option 2 below for static export solution
}
```

**⚠️ Limitation:** Dynamic routes don't work with `output: 'export'` because Next.js can't know all project IDs at build time.

---

### Option 2: Client-Side Routing with Hash URLs ✅ (Works with Static Export)

**Structure:**
```
app/
└── page.tsx                    # Single page with hash routing
```

**URLs:**
- `/#/` - Project list
- `/#/project/abc-123` - Specific project
- `/#/project/def-456` - Another project

**Benefits:**
- ✅ Works with static export
- ✅ Shareable URLs
- ✅ Browser back/forward works
- ✅ No server required
- ✅ Single HTML file

**Implementation:**

1. **Install a hash router library:**
```bash
npm install react-router-dom
```

2. **Update `app/page.tsx`:**
```typescript
'use client';

import { HashRouter, Routes, Route, useParams } from 'react-router-dom';

function ProjectListPage() {
  // Show all projects
}

function ProjectPage() {
  const { id } = useParams();
  // Show specific project
}

export default function Home() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/project/:id" element={<ProjectPage />} />
      </Routes>
    </HashRouter>
  );
}
```

**Pros:**
- Works perfectly with static export
- No build-time configuration needed
- Simple to implement

**Cons:**
- URLs have `#` in them (e.g., `/#/project/123`)
- Slightly less "clean" than regular routes

---

### Option 3: Query Parameters (Simplest) ✅

**Structure:**
```
app/
└── page.tsx                    # Single page with query params
```

**URLs:**
- `/` - Project list
- `/?project=abc-123` - Specific project
- `/?project=def-456` - Another project

**Benefits:**
- ✅ Works with static export
- ✅ Minimal code changes
- ✅ Shareable URLs
- ✅ Browser back/forward works

**Implementation:**

1. **Update `app/page.tsx`:**
```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('project');
  
  const handleProjectSelect = (id: string) => {
    router.push(`/?project=${id}`);
  };
  
  // If projectId exists, show that project
  // Otherwise show project list
  
  return projectId ? (
    <ProjectView projectId={projectId} />
  ) : (
    <ProjectList onSelect={handleProjectSelect} />
  );
}
```

**Pros:**
- Easiest to implement
- Works with static export
- No additional dependencies

**Cons:**
- URLs less semantic (`/?project=123` vs `/project/123`)
- All on one page (no separate components)

---

## Recommendation

**For your static export setup, I recommend Option 2 (Hash Router) or Option 3 (Query Params).**

### Quick Comparison

| Feature | Option 1 (Dynamic) | Option 2 (Hash) | Option 3 (Query) |
|---------|-------------------|-----------------|------------------|
| Static Export | ❌ No | ✅ Yes | ✅ Yes |
| Clean URLs | ✅ `/project/123` | ⚠️ `/#/project/123` | ⚠️ `/?project=123` |
| Shareable | ✅ Yes | ✅ Yes | ✅ Yes |
| Back/Forward | ✅ Yes | ✅ Yes | ✅ Yes |
| Complexity | High | Medium | Low |
| Dependencies | None | react-router-dom | None |

### My Recommendation: **Option 3 (Query Params)**

**Why:**
- ✅ Simplest to implement (minimal code changes)
- ✅ No additional dependencies
- ✅ Works perfectly with static export
- ✅ Shareable URLs
- ✅ Browser navigation works
- ⚠️ URLs slightly less clean (but functional)

**Implementation time:** ~30 minutes

Would you like me to implement one of these options?
