# LinkPulse Frontend: Exhaustive Technical Manual

This document provides a highly detailed, file-by-file breakdown of the **LinkPulse** frontend. It covers the React component architecture, Next.js routing, and the complex data-flow patterns used for AI streaming and knowledge visualization.

---

## 🏗️ 1. Architecture & Global Config

### `layout.tsx`
The root layout for the Next.js application.
- **Key Responsibilities**:
    - Defines the application metadata (title, description).
    - Configures the **Inter** font via `next/font/google`.
    - Warps the `children` in a root HTML structure with Tailwind's `antialiased` class.
    - Specifically mounts the `CommandPalette` globally so it can be triggered via keyboard shortcuts from any page.

### `package.json`
- **Framework**: Next.js 14.2.3 (App Router).
- **Core Stacks**:
    - **UI**: Radix UI (Dialog, Tabs, Select, etc.) + Tailwind CSS.
    - **Animation**: `framer-motion`.
    - **Visualization**: `react-force-graph-2d` (base for Knowledge Graph).
    - **Markdown**: `react-markdown` + `remark-gfm` for code and list rendering.

---

## 📡 2. Core Feature Pages (`src/app`)

### `chat/page.tsx`
The orchestration engine for the AI RAG experience.
- **Key Responsibilities**:
    - Implements **Streaming Chat Fetching**: Uses the `fetch` API with `ReadableStream` and `TextDecoder` to parse manual-chunked data from the backend.
    - **Metadata Interception**: Parses custom `metadata:` prefix lines in the stream to display synthesized sources before the response finish.
    - **Source Filter Panel**: A complex UI allowing users to filter knowledge sources by Repository, Folder, or Type.
- **Core Functions**:
    - `handleSubmit(e)`: Async function that manages message state, triggers the stream, and performs post-processing on sources.
    - `groupSourcesForFilter()`: Logic to categorize hundreds of sources into a hierarchal filter UI.

### `dashboard/page.tsx`
The primary command center for knowledge management.
- **Key Responsibilities**:
    - Manage **Multi-Source Ingestion**: Handles file uploads, single URL crawling, and bulk website imports.
    - **Status Polling**: Every 3 seconds, it polls the `/api/v1/ingestion/tasks` endpoint to track background job progress.
    - **Source Organization**: Automatically groups documents into expandable sections based on their metadata (Repository or Folder name).
- **Core Functions**:
    - `handleUrlIngest(type)` / `handleMultiUrlIngest()`: Triggers backend ingestion jobs.
    - `handleSummarize(sourceUrl)`: Triggers a dedicated summarization agent for the selected document.
    - `handleDeleteSource(sourceUrl)`: Enforces resource cleanup.

### `knowledge-graph/page.tsx`
A high-performance visualization of the Knowledge Base.
- **Key Responsibilities**:
    - Implements a **Custom Force Simulation**: While it references graph types, it uses a low-level Canvas implementation for the simulation (Repulsion, Attraction, Center Pull).
    - **Dynamic Interaction**: Supports panning, zooming (to cursor), and node dragging.
- **Core Math**:
    - `repulsion`: Calculated as `3000 / dist^2` for all pairs.
    - `attraction`: Calculated along edges with weight-based ideal distances.
    - `CenterPull`: Ensures the graph stays localized.

---

## 🧩 3. Key Components (`src/components`)

### `Sidebar.tsx`
The persistent navigation spine.
- **Logic**: 
    - Implements **Theme Switching**: Manages a `theme` key in `localStorage` and toggles the `dark` class on `document.documentElement`.
    - **Auto-Highlight**: Uses Next.js `usePathname` to apply active styles to the current route.

### `CommandPalette.tsx`
A "Spotlight-style" global search utility.
- **Logic**: 
    - Listens for `Meta+K` or `Ctrl+K` globally.
    - **Hybrid Search**: Searches across navigation routes, system actions (logout/theme), and **Recently Ingested Sources**.
    - **Keyboard Navigation**: Implements custom up/down indexing for result selection.

### `ui/MultiFileUpload.tsx` (Inferred from usage)
- **Logic**: Handles the state for drag-and-drop file interactions. It maps over selected files and fires individual upload requests to `/api/v1/ingestion/upload`.

---

## 💾 4. Data Patterns & State Management

### 1. **Reactive State (No Global Store)**
The application avoids heavy global state like Redux. Instead, it relies on:
- **Local Persistence**: `localStorage` for JWT tokens, theme preferences, and sorting modes.
- **Context-Free Propagation**: Passing props through components or using the URL (via Next.js `router`) to drive UI state.

### 2. **Security & Auth**
- Every API-facing component implements a `getToken()` helper that pulls from `localStorage`.
- All requests use an `Authorization: Bearer <token>` header.
- Components typically include an "Auth Check" (redirecting to `/login` if empty) within a `useEffect`.

### 3. **AI Streaming Loop**
```typescript
const reader = response.body?.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    // Logic to handle 'data:', 'metadata:', or 'error:' prefixes
}
```
This pattern is used in the Chat to keep the UI fluid and responsive during long LLM generations.

---

> [!TIP]
> **Performance Optimization**: The Knowledge Graph uses `requestAnimationFrame` and a sub-sampled simulation update rate to ensure 60FPS even with hundreds of nodes on the Canvas.
