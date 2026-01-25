import type { Patient, PatientTask } from '../types';
import { calculateTaskProgress } from './progressUtils';

export type PatientWithTasks = Patient & { tasks: PatientTask[] };

const PRIORITY_MAP: Record<string, number> = {
    'lab': 1,
    'imaging': 2,
    'consult': 3,
    'paperwork': 4,
    'procedure': 5,
    'supervision': 6
};

const CATEGORY_EMOJIS: Record<string, string> = {
    'lab': '🧪',
    'imaging': '🩻',
    'consult': '🩺',
    'paperwork': '📋',
    'procedure': '🩹',
    'supervision': '👁️',
    'admin': '📝', // Fallback
    'default': '❓'
};

const getEmojiForCategory = (type: string): string => {
    const key = type.toLowerCase();
    return CATEGORY_EMOJIS[key] || CATEGORY_EMOJIS['default'];
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const generateHandoffText = (patients: PatientWithTasks[], mode: 'all' | 'missing'): string => {
    let report = '';

    // Sort patients by bed number numerically
    const sortedPatients = [...patients].sort((a, b) => {
        // Handle both DB shape (bed_number) and UI shape (bedNumber)
        const bedA = (a as any).bed_number || (a as any).bedNumber || '0';
        const bedB = (b as any).bed_number || (b as any).bedNumber || '0';

        const numA = parseInt(bedA) || 0;
        const numB = parseInt(bedB) || 0;
        return numA - numB;
    });

    for (const patient of sortedPatients) {
        // Accessor for bed number
        const bedNumber = (patient as any).bed_number || (patient as any).bedNumber || '??';

        const hasTasks = patient.tasks && patient.tasks.length > 0;

        if (!hasTasks) {
            if (mode === 'all') {
                // Include empty beds in 'all' mode
                const header = `*CAMA ${bedNumber} – 100% completado*`;
                report += `\n${header}\n`;
                continue;
            } else {
                // Skip empty beds in 'missing' mode
                continue;
            }
        }

        let tasksToInclude = [...patient.tasks];

        // Filter Logic
        if (mode === 'missing') {
            // "Incluye SOLO las tareas donde steps.some(step => !step.value)"
            tasksToInclude = tasksToInclude.filter(t =>
                !t.is_completed && (t.steps?.some(s => !s.value) ?? true)
            );

            if (tasksToInclude.length === 0) continue; // Skip patient if no pending tasks
        }

        // Sort Logic (Strict Priority)
        tasksToInclude.sort((a, b) => {
            const pA = PRIORITY_MAP[a.type.toLowerCase()] || 99;
            const pB = PRIORITY_MAP[b.type.toLowerCase()] || 99;
            return pA - pB;
        });

        // Build Patient Header
        let header = '';
        if (mode === 'all') {
            const progress = calculateTaskProgress(patient.tasks || []);
            header = `*CAMA ${bedNumber} – ${progress.percentage}% completado*`;
        } else {
            header = `*CAMA ${bedNumber} – Tareas que faltan:*`;
        }

        report += `\n${header}\n`;

        // Build Task Lines
        for (const task of tasksToInclude) {
            const emoji = getEmojiForCategory(task.type);
            const category = capitalize(task.type);
            const desc = task.description;

            // Step Visualizer: ✅ ⬜️
            const stepsVisual = (task.steps || [])
                .map(s => s.value ? '✅' : '⬜️')
                .join(' ');

            report += `- ${emoji} ${category}: ${desc} ${stepsVisual}\n`;
        }
    }

    return report.trim();
};
