export function statusSuffix(catStatus: string | null | undefined): string {
  switch (catStatus) {
    case "MIA":      return "m";
    case "Deceased": return "d";
    case "Adopted":  return "a";
    case "Fostered": return "f";
    default:         return "";
  }
}

export function parseCatalogId(colA: string): number | null {
  const match = colA.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return isNaN(n) ? null : n;
}

export function catalogDisplay(
  lookup: Map<string, string>,
  catId: string,
  catStatus: string | null | undefined,
): string {
  const base = parseCatalogId(lookup.get(catId) ?? "");
  return base !== null ? `${base}${statusSuffix(catStatus)}` : "";
}

export function nextCatalogId(existingColAValues: string[]): number {
  const nums = existingColAValues
    .map(parseCatalogId)
    .filter((n): n is number => n !== null);
  return nums.length === 0 ? 1 : Math.max(...nums) + 1;
}
