# EVOS & BH Module - Frontend Implementation Handoff
## For: Antigravity Gemini 3.1 (UI/UX Implementation)

---

## Executive Summary

The backend and state engine for the **EVOS & BH (Evoluciones y Balances Hídricos)** module is complete. This document provides all critical information needed to implement the frontend UI.

**Module Purpose**: Binary Confirmation Matrix - tracks two boolean states per patient per day:
- `evos_done`: Has the Evolución been completed?
- `bh_done`: Has the Balance Hídrico been completed?

---

## Hook API Reference

### Import
```typescript
import { useEvosBh, PatientTracking, TrackingStats } from '../hooks/useEvosBh';
```

### Usage
```typescript
const {
    trackingMatrix,      // Map<patientId, PatientTracking>
    loading,             // boolean
    error,               // string | null
    toggleField,         // (patientId, field) => void
    refresh,             // () => void
    stats,               // TrackingStats
    getPatientTracking   // (patientId) => PatientTracking | undefined
} = useEvosBh(selectedDate, wardId, patientIds);
```

### Parameters
| Parameter | Type | Source |
|-----------|------|--------|
| `selectedDate` | `Date` | From MainLayout context (`selectedDate`) |
| `wardId` | `string \| null` | From AppContext (`activeWard?.id`) |
| `patientIds` | `string[]` | Derived from `rawPatients.map(p => p.id)` |

### Return Values

#### `trackingMatrix: Map<string, PatientTracking>`
```typescript
interface PatientTracking {
    patientId: string;
    evosDone: boolean;   // Has Evolución been done?
    bhDone: boolean;     // Has Balance Hídrico been done?
    recordId: string | null;  // null if no DB record yet
}
```

#### `stats: TrackingStats`
```typescript
interface TrackingStats {
    evosComplete: number;      // Count of patients with evosDone=true
    bhComplete: number;        // Count of patients with bhDone=true
    total: number;             // Total patients in ward
    evosPercentage: number;    // 0-100 (rounded)
    bhPercentage: number;      // 0-100 (rounded)
}
```

#### `toggleField: (patientId: string, field: 'evos_done' | 'bh_done') => void`
- **Optimistic**: Updates UI immediately
- **Resilient**: Rolls back on error
- **Note**: Field parameter uses snake_case (`evos_done`, `bh_done`)

---

## Integration Example

```tsx
// In your EVOS panel component
import { useEvosBh } from '../hooks/useEvosBh';
import { useOutletContext } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';

const EvosBhPanel: React.FC = () => {
    const { rawPatients, selectedDate } = useOutletContext<DashboardContextType>();
    const { activeWard } = useAppContext();

    const patientIds = React.useMemo(
        () => rawPatients.map(p => p.id),
        [rawPatients]
    );

    const {
        trackingMatrix,
        loading,
        error,
        toggleField,
        stats,
        getPatientTracking
    } = useEvosBh(selectedDate, activeWard?.id || null, patientIds);

    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;

    return (
        <div>
            {/* Progress Header */}
            <div className="flex gap-4 mb-4">
                <ProgressBar
                    label="Evoluciones"
                    value={stats.evosPercentage}
                    count={`${stats.evosComplete}/${stats.total}`}
                />
                <ProgressBar
                    label="Balances Hídricos"
                    value={stats.bhPercentage}
                    count={`${stats.bhComplete}/${stats.total}`}
                />
            </div>

            {/* Patient Matrix */}
            {rawPatients.map(patient => {
                const tracking = getPatientTracking(patient.id);
                return (
                    <PatientRow
                        key={patient.id}
                        bedNumber={patient.bed_number}
                        diagnosis={patient.diagnosis}
                        evosDone={tracking?.evosDone ?? false}
                        bhDone={tracking?.bhDone ?? false}
                        onToggleEvos={() => toggleField(patient.id, 'evos_done')}
                        onToggleBh={() => toggleField(patient.id, 'bh_done')}
                    />
                );
            })}
        </div>
    );
};
```

---

## Critical UI/UX Considerations

### 1. Toggle Button States
```
[ ] Unchecked (false) → Gray/neutral state
[✓] Checked (true)    → Green/success state
```

**Recommendation**: Use large tap targets (min 44px) for mobile. Binary toggles should be visually distinct.

### 2. Progress Indicators
The `stats` object provides percentages for progress visualization:
```tsx
// Example: Circular progress or bar
<div className="text-sm">
    Evoluciones: {stats.evosComplete}/{stats.total} ({stats.evosPercentage}%)
</div>
```

### 3. Loading States
- Initial load: Show skeleton/spinner
- Toggle action: Optimistic update means NO loading state needed for toggles

### 4. Error Handling
- `error` state only appears on fetch failure or Realtime connection error
- Individual toggle failures auto-rollback (no UI error needed)

### 5. Date Navigation
The hook automatically:
- Refetches when `selectedDate` changes
- Clears data when switching wards
- Fills new patients with `false/false` defaults

---

## Visual Design Suggestions

### Option A: Compact Table View
```
┌────────┬──────────────────┬───────┬─────┐
│  Cama  │    Diagnóstico   │ EVOS  │ BH  │
├────────┼──────────────────┼───────┼─────┤
│   87   │ Neumonía NAC III │  [✓]  │ [ ] │
│   88   │ ICC descompensada│  [ ]  │ [✓] │
│   89   │ EPOC exacerbado  │  [✓]  │ [✓] │
└────────┴──────────────────┴───────┴─────┘
```

### Option B: Card Grid (Mobile-First)
```
┌─────────────────────────────┐
│ Cama 87 - Neumonía NAC III  │
│ ┌─────────┐  ┌─────────┐    │
│ │  EVOS   │  │   BH    │    │
│ │   [✓]   │  │   [ ]   │    │
│ └─────────┘  └─────────┘    │
└─────────────────────────────┘
```

### Color Semantics
| State | Suggested Color |
|-------|-----------------|
| Not done (false) | Gray-200 / Slate-200 |
| Done (true) | Green-500 / Emerald-500 |
| All complete for patient | Green glow/border |

---

## File Locations

| Purpose | File |
|---------|------|
| Hook | `src/hooks/useEvosBh.ts` |
| API Functions | `src/services/api.ts` (search for `fetchDailyTracking`) |
| Types | Exported from `useEvosBh.ts` |

---

## Testing Checklist

- [ ] Toggle EVOS for a patient → Verify immediate UI update
- [ ] Toggle BH for same patient → Both states independent
- [ ] Refresh page → States persist
- [ ] Open two browser tabs → Toggle in one, verify sync in other
- [ ] Change date → Matrix resets/reloads for new date
- [ ] Switch wards → Data clears, new ward loads
- [ ] Add new patient (bed config) → Appears in matrix with false/false

---

## DO NOT

- **DO NOT** call `api.toggleTracking` directly - use `toggleField` from hook
- **DO NOT** manage tracking state separately - the hook handles everything
- **DO NOT** use `toISOString()` for dates - the hook uses `formatDateForDB()` internally
- **DO NOT** worry about Realtime subscription - hook manages it

---

## Questions?

The backend is designed to be drop-in ready. The hook handles:
- Multi-tenant isolation (ward filtering)
- Realtime sync between devices
- Optimistic updates with rollback
- Date-scoped data management

Focus purely on visual presentation and user interaction patterns.
