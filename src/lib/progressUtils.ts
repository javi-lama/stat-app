import type { PatientTask } from '../types';

export interface ProgressStats {
    percentage: number;
    completedSteps: number;
    totalSteps: number;
    colorClass: string;
    bgClass: string;
    textClass: string;
}

export const calculateTaskProgress = (tasks: PatientTask[] = []): ProgressStats => {
    let totalSteps = 0;
    let completedStepsCount = 0;

    tasks.forEach((task) => {
        // If steps exist, count them.
        if (task.steps && task.steps.length > 0) {
            totalSteps += task.steps.length;
            completedStepsCount += task.steps.filter((s) => s.value).length;
        } else {
            // Fallback if no steps are defined but we treat the task itself as a unit?
            // Based on the prompt: "calculen dinámicamente el porcentaje de finalización de tareas basándose en el estado de los checkboxes (steps)."
            // So we strictly look at steps.
            // If a task has NO steps, it technically contributes 0 to the denominator and numerator?
            // Or should we treat a task without steps as 1 step?
            // Let's assume tasks usually have steps in this app.
            // If strict interpretation:
            // totalSteps += 0
        }
    });

    const percentage =
        totalSteps === 0 ? 0 : Math.round((completedStepsCount / totalSteps) * 100);

    // 1.3. Color Logic (Gradiente Semántico)


    // Specific mapping based on User request
    // 0-20%: text-red-500 / bg-red-500
    // 21-40%: text-orange-500 / bg-orange-500
    // 41-60%: text-yellow-500 / bg-yellow-500
    // 61-80%: text-lime-500 / bg-lime-500
    // 81-100%: text-green-500 / bg-green-500

    // To make it fully Tailwind safe, we return the full class strings
    // Note: We might need to safelist these if Tailwind doesn't pick them up dynamically,
    // but usually complete strings in code work fine with JIT.

    let colorClass = '';
    let bgClass = '';
    let textClass = '';

    if (percentage <= 20) {
        colorClass = 'text-red-500';
        bgClass = 'bg-red-500';
        textClass = 'text-red-500'; // "progress-text-low" equivalent? HTML used progress-text-low as orange for 33%.
        // User mapping:
        // 0-20: red
    } else if (percentage <= 40) {
        colorClass = 'text-orange-500';
        bgClass = 'bg-orange-500';
        textClass = 'text-orange-500';
    } else if (percentage <= 60) {
        colorClass = 'text-yellow-500';
        bgClass = 'bg-yellow-500';
        textClass = 'text-yellow-500';
    } else if (percentage <= 80) {
        colorClass = 'text-lime-500';
        bgClass = 'bg-lime-500';
        textClass = 'text-lime-500';
    } else {
        colorClass = 'text-green-500';
        bgClass = 'bg-green-500';
        textClass = 'text-green-500';
    }

    return {
        percentage,
        completedSteps: completedStepsCount,
        totalSteps,
        colorClass,
        bgClass,
        textClass,
    };
};
