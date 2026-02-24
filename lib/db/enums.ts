import { pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

export const URGENCY_VALUES = [
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
] as const;

export const UrgencyEnum = z.enum(URGENCY_VALUES);
