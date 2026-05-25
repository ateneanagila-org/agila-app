"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/regions.repo";
import { requireAuth } from "@/lib/auth/rbac";

export const getRegions = actionClient.action(async () => {
  await requireAuth();
  return await repo.findRegions();
});
