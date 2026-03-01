# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STAT. is a high-performance hospital workflow management system (EHR-lite) for real-time clinical task execution. Built for medical teams in Peru with Spanish-first UI.

**Current:** v2.0-evos-bh branch (Multi-tenant + EVOS/BH tracking module)

## Commands

```bash
npm run dev          # Start Vite dev server (HMR)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint check
npm run preview      # Preview production build locally
```

No test runner configured yet.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.9 (strict mode)
- **Routing:** React Router 7
- **State:** React Context API + Custom Hooks
- **Styling:** Tailwind CSS 4 + custom theme (primary: #2985a3)
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (PostgreSQL + Realtime WebSockets + RLS)
- **Build:** Vite 7
- **Notifications:** Sonner

## Architecture

### Directory Structure

```
src/
├── main.tsx              # Entry point with StrictMode + AppProvider
├── App.tsx               # React Router config
├── contexts/AppContext   # Global state: auth session, user, activeWard
├── components/           # UI components
├── hooks/                # Custom hooks (realtime, optimistic mutations)
├── services/api.ts       # Supabase API layer (50+ functions)
├── lib/                  # Utilities (dateUtils, progressUtils, handoffGenerator)
└── types.ts              # TypeScript interfaces
```

### Key Components

- **MainLayout.tsx** - Date navigation + census data fetching
- **WardLobby.tsx** - Ward selection (multi-tenant entry point)
- **WardDashboard.tsx** - Main patient grid with task management
- **PatientCard.tsx** - Individual patient/bed display with tasks
- **EvosBhTracker.tsx** - Daily EVOS & BH tracking matrix

### Custom Hooks (Critical)

- **useRealtimeCensus** - Fetches patients/tasks + Supabase Realtime subscriptions
- **useOptimisticMutations** - "Trust but Verify" pattern for instant UI + server sync
- **useEvosBh** - EVOS/BH tracking with optimistic updates + realtime

## Core Patterns

### 1. Multi-Tenant Ward Isolation

- All data scoped by `ward_id` (hospital department)
- API calls require wardId parameter
- Realtime subscriptions use `filter: ward_id=eq.${wardId}`
- Client-side gatekeeper validates events belong to current ward

### 2. Optimistic Updates ("Trust but Verify")

- **TRUST:** Immediate UI update with temporary ID
- **VERIFY:** Server confirms, replace tempId with real ID
- **ROLLBACK:** Automatic revert on errors
- Prevents double-clicks with `hasPendingMutations` guard

### 3. Realtime Subscriptions

- Channel naming: `realtime:census:${wardId}:${dateStr}`
- Server-side filter on `ward_id` for patients table
- Client-side gatekeeper for tasks (no direct ward_id column)
- useRef to prevent stale closures in callbacks

### 4. Soft Deletes

- Tasks use `deleted_at` timestamp instead of hard delete
- Enables undo functionality
- Query excludes `deleted_at IS NOT NULL`

### 5. UPSERT for Daily Tracking

- `daily_tracking` table: unique on (patient_id, tracking_date)
- toggleTracking() uses UPSERT - creates if not exists, updates if exists

## Database Schema (Supabase)

### Core Tables

- **patients** - ward_id, bed_number, diagnosis, status
- **tasks** - patient_id, description, steps (JSONB), is_completed, deleted_at
- **daily_tracking** - patient_id, tracking_date, evos_done, bh_done, assigned_md
- **profiles** - user profile linked to auth
- **wards** - hospital departments/services

### Task Types

```
lab | imaging | admin | procedure | consult | paperwork | supervision
```

### Task Steps (JSONB)

```json
[{ "label": "Ordenado", "value": true }, { "label": "Hecho", "value": false }, { "label": "Revisado", "value": false }]
```

## Styling Conventions

### Tailwind Theme (src/index.css)

- Primary: `#2985a3` (healthcare blue)
- Secondary: `#57818e`
- Success: `#40BF40`
- Use `cn()` utility from lib/utils.ts for class composition

### Class Utility

```typescript
import { cn } from '@/lib/utils';
cn('base-class', condition && 'conditional-class', props.className)
```

### Icons

Material Symbols font (Outlined, weight 400-700):
```tsx
<span className="material-symbols-outlined">icon_name</span>
```

## Spanish-First UI

All user-facing text is in Spanish. No i18n library - strings hardcoded.

- Date formatting: `toLocaleDateString('es-ES', {...})`
- "Hoy" (Today), "Editar" (Edit), "Borrar" (Delete)

## API Patterns (services/api.ts)

### Fetching with Ward Scope

```typescript
const { data } = await supabase
  .from('patients')
  .select('*')
  .eq('ward_id', wardId);
```

### INNER JOIN for Related Tables

```typescript
const { data } = await supabase
  .from('tasks')
  .select('*, patients!inner(ward_id)')
  .eq('patients.ward_id', wardId);
```

### Date Formatting

```typescript
import { formatDateForDB } from '@/lib/dateUtils';
formatDateForDB(new Date()) // "2026-03-01"
```

## State Flow

```
User Action → Component → useOptimisticMutations (instant UI)
                              ↓
                        api.ts (Supabase call)
                              ↓
                        PostgreSQL + Realtime broadcast
                              ↓
                        useRealtimeCensus (event handler)
                              ↓
                        State update → Re-render
```

## Known Issues / Pending

- **Realtime EVOS/BH:** WebSocket timeout in dev due to React StrictMode double-mount. Production works fine. Fix postponed (ref-based guards planned).
- **PWA:** Manifest configured but no service worker for offline support.

## Do NOT

- Add English translations without explicit request
- Remove StrictMode from main.tsx
- Use Redux or external state management
- Create hard deletes - use soft delete pattern
- Skip wardId validation in API calls
