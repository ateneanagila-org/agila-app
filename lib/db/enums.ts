import { pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

// GSheets Sync Queue Action Status
export const ACTION_STATUS = ["PENDING", "COMPLETED", "FAILED"] as const;
export const actionStatusEnum = pgEnum("action_status", ACTION_STATUS);
export const ActionStatusEnum = z.enum(ACTION_STATUS);
export type ActionStatus = z.infer<typeof actionStatusEnum>;

// GSheets Sync Queue Action
export const ACTION = ["CREATE", "UPDATE", "DELETE"] as const;
export const actionEnum = pgEnum("action", ACTION);
export const ActionEnum = z.enum(ACTION);
export type Action = z.infer<typeof actionEnum>;

// User AuthRoles
export const AUTH_ROLE_VALUES = [
  "Administrator",
  "Manager",
  "Volunteer",
] as const;
export const authRoleEnum = pgEnum("auth_role", AUTH_ROLE_VALUES);
export const AuthRoleEnum = z.enum(AUTH_ROLE_VALUES);
export type AuthRole = z.infer<typeof AuthRoleEnum>;

// Region Status
export const REGION_COLOR_VALUES = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Gray",
  "Brown",
  "Pink",
] as const;
export const regionColorEnum = pgEnum("region_color", REGION_COLOR_VALUES);
export const RegionColorEnum = z.enum(REGION_COLOR_VALUES);
export type RegionColor = z.infer<typeof RegionColorEnum>;

// Region Name
export const REGION_NAME_VALUES = [
  "GATE 3",
  "ARETE",
  "SDC",
  "ISO",
  "BEL",
  "LEONG",
  "NEW RIZAL",
  "FAURA",
  "OLD RIZAL",
  "FABER",
  "MVP",
  "SCHMITT",
  "GONZ",
  "XAVIER",
  "KOSTKA",
  "SEC",
  "CTC/SOM",
  "JSEC",
  "PIPAC",
  "CERVINI",
  "ELIAZO",
  "UNI DORM",
  "EBAIS",
  "POLLOCK",
  "COV COURTS",
  "OLD COMMS",
  "LST",
  "GATE 5",
  "ASHS",
  "AJHS",
  "MORO",
  "EAPI",
  "GATE 2",
  "GATE 1",
  "BEG",
  "AGS",
  "UNKNOWN",
] as const;
// Region names are now stored as free text in the regions table (the table is
// the source of truth). REGION_NAME_VALUES is retained only as seed/initial data.
export type RegionName = string;

// Cat Color
export const CAT_COLOR_VALUES = [
  "Black",
  "White",
  "Black and White",
  "Calico",
  "Tortie",
  "Torbie",
  "Orange Tabby",
  "Orange and White Tabby",
  "Gray Tabby",
  "Gray and White Tabby",
  "Brown Tabby",
  "Brown and White Tabby",
] as const;
export const catColorEnum = pgEnum("cat_color", CAT_COLOR_VALUES);
export const CatColorEnum = z.enum(CAT_COLOR_VALUES);
export type CatColor = z.infer<typeof CatColorEnum>;

// Cat Age
export const CAT_AGE_VALUES = [
  "Neonatal",
  "Kitten",
  "Juvenile",
  "Adult",
] as const;
export const catAgeEnum = pgEnum("cat_age", CAT_AGE_VALUES);
export const CatAgeEnum = z.enum(CAT_AGE_VALUES);
export type CatAge = z.infer<typeof CatAgeEnum>;

// Cat Sex
export const CAT_SEX_VALUES = ["Female", "Male"] as const;
export const catSexEnum = pgEnum("cat_sex", CAT_SEX_VALUES);
export const CatSexEnum = z.enum(CAT_SEX_VALUES);
export type CatSex = z.infer<typeof CatSexEnum>;

// Cat Sociability
export const CAT_SOCIABILITY_VALUES = [
  "Domesticated",
  "Tame",
  "Feral",
] as const;
export const catSociabilityEnum = pgEnum(
  "cat_sociability",
  CAT_SOCIABILITY_VALUES,
);
export const CatSociabilityEnum = z.enum(CAT_SOCIABILITY_VALUES);
export type CatSociability = z.infer<typeof CatSociabilityEnum>;

// Cat Status
export const CAT_STATUS_VALUES = [
  "Deceased",
  "Fostered",
  "Adopted",
  "MIA",
] as const;
export const catStatusEnum = pgEnum("cat_status", CAT_STATUS_VALUES);
export const CatStatusEnum = z.enum(CAT_STATUS_VALUES);
export type CatStatus = z.infer<typeof CatStatusEnum>;

// Cat Entry_Status
export const CAT_ENTRY_STATUS_VALUES = [
  "Unsubmitted",
  "Unreviewed",
  "Merged",
  "Original",
] as const;
export const catEntryStatusEnum = pgEnum(
  "cat_entry_status",
  CAT_ENTRY_STATUS_VALUES,
);
export const CatEntryStatusEnum = z.enum(CAT_ENTRY_STATUS_VALUES);
export type CatEntryStatus = z.infer<typeof CatEntryStatusEnum>;

//  CatHealthRecord Condition
export const CATHEALTHRECORD_CONDITION_VALUES = [
  "Healthy",
  "Sick",
  "Injured",
  "Sick and Injured",
] as const;
export const catHealthRecordConditionEnum = pgEnum(
  "cathealthrecord_status",
  CATHEALTHRECORD_CONDITION_VALUES,
);
export const CatHealthRecordConditionEnum = z.enum(
  CATHEALTHRECORD_CONDITION_VALUES,
);
export type CatHealthRecordCondition = z.infer<
  typeof CatHealthRecordConditionEnum
>;

// Intervention Type
export const INTERVENTION_TYPE_VALUES = ["TNVR", "Veterinarian"] as const;
export const interventionTypeEnum = pgEnum(
  "intervention_type",
  INTERVENTION_TYPE_VALUES,
);
export const InterventionTypeEnum = z.enum(INTERVENTION_TYPE_VALUES);
export type InterventionType = z.infer<typeof InterventionTypeEnum>;

export const INTERVENTION_STATUS_VALUES = [
  "Pending",
  "Finished",
  "Cancelled",
] as const;
export const interventionStatusEnum = pgEnum(
  "intervention_status",
  INTERVENTION_STATUS_VALUES,
);
export const InterventionStatusEnum = z.enum(INTERVENTION_STATUS_VALUES);
export type InterventionStatus = z.infer<typeof InterventionStatusEnum>;

// Sync Audit Log Direction
export const SYNC_DIRECTION_VALUES = ["FORWARD", "REVERSE"] as const;
export const syncDirectionEnum = pgEnum(
  "sync_direction",
  SYNC_DIRECTION_VALUES,
);
export const SyncDirectionEnum = z.enum(SYNC_DIRECTION_VALUES);
export type SyncDirection = z.infer<typeof SyncDirectionEnum>;

// Bug Report Status
export const BUG_REPORT_STATUS_VALUES = ["Open", "Resolved"] as const;
export const bugReportStatusEnum = pgEnum(
  "bug_report_status",
  BUG_REPORT_STATUS_VALUES,
);
export type BugReportStatus = (typeof BUG_REPORT_STATUS_VALUES)[number];

// FOR TESTING
export const URGENCY_VALUES = [
  "Now",
  "Within the hour",
  "Within the day",
  "Within the week",
  "Indefinite",
] as const;
export const UrgencyEnum = z.enum(URGENCY_VALUES);
export const urgencyEnum = pgEnum("urgency", URGENCY_VALUES);
