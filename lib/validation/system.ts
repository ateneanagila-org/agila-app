import { z } from "zod";

/**
 * A referral link. `null` means "clear this and fall back to the compiled-in
 * default"; `undefined` means "leave it alone".
 */
const linkUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .startsWith("https://", "Link must start with https://")
  .max(2000, "URL too long")
  .nullable();

export const updateLinksSchema = z
  .object({
    censusReport: linkUrl.optional(),
    referralSheet: linkUrl.optional(),
    adoptFoster: linkUrl.optional(),
  })
  .refine(
    (v) =>
      v.censusReport !== undefined ||
      v.referralSheet !== undefined ||
      v.adoptFoster !== undefined,
    { message: "Provide at least one link to update." },
  );

export type UpdateLinksInput = z.infer<typeof updateLinksSchema>;
