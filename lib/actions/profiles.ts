"use server";
import { createClient } from "@/lib/supabase/server";

import * as usersService from "@/lib/services/profiles.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindProfilesSchema,
  UpdateProfileSchema,
} from "@/lib/validation/profiles";

export async function getProfiles(filters: FindProfilesSchema) {
  return await handleAction(() => usersService.getProfiles(filters));
}

export async function editProfile(id: string, data: UpdateProfileSchema) {
  return await handleAction(() => usersService.editProfile(id, data));
}

export async function createProfile(id: string) {
  return await handleAction(() => usersService.createProfile(id));
}

export async function getSupabaseUser() {
  const supabase = await createClient();
  return await supabase.auth.getUser();
}
