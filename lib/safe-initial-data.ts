function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function loadData<T>(
  label: string,
  action: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.warn(`${label}: ${getErrorMessage(error)}`);
    return fallback;
  }
}
