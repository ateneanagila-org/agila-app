import { SQL, AnyColumn, eq } from "drizzle-orm";

export const getDayRange = (date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

export function createEQFilters<TColumns extends Record<string, AnyColumn>>(
  cols: TColumns,
  filters: { [K in keyof TColumns]?: unknown },
): SQL[] {
  const keys = Object.keys(filters) as (keyof TColumns)[];

  return keys.reduce<SQL[]>((acc, key) => {
    const value = filters[key];
    const column = cols[key];

    // Only add to the conditions array if the value is not null or undefined
    if (value !== undefined && value !== null) {
      // To hell with typescript. We use a double cast (as unknown as ...) to satisfy our linters
      // Parameters<typeof eq>[1] targets exactly what Drizzle expects for the value
      acc.push(eq(column, value as unknown as Parameters<typeof eq>[1]));
    }

    return acc;
  }, []);
}
