import * as usersRepo from "../repo/users";
import {
  FindProfilesSchema,
  UpdateProfileSchema,
} from "../validation/profiles";

export async function getProfiles(filters: FindProfilesSchema) {
  return await usersRepo.findProfiles(filters);
}

export async function createProfile(id: string) {
  return await usersRepo.insertProfile(id);
}

export async function editProfile(id: string, data: UpdateProfileSchema) {
  return await usersRepo.updateProfile(id, data);
}
