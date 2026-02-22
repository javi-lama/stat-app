export const formatDateForDB = (date: Date): string => {
    // Returns YYYY-MM-DD in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatDateForUI = (date: Date): string => {
    // Returns "Today, 1 Feb" or "Mon, 31 Jan"
    const today = new Date();
    const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    };

    const formatted = date.toLocaleDateString('es-ES', options); // e.g. "Mon, Feb 1" or "Mon, 1 Feb" depending on locale

    if (isToday) {
        // Replace Weekday with "Hoy" if it's today
        // We can just append the date part
        const dayMonth = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return `Hoy, ${dayMonth}`;
    }

    return formatted;
};

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
