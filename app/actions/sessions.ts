"use server";
import { actionClient } from "@/lib/error/actions-handler";
import * as repo from "@/lib/repo/sessions.repo";
import * as service from "@/lib/services/sessions.service";
import * as catsService from "@/lib/services/cats.service";
import {
  requireAuth,
  requireRole,
  hasRole,
  MANAGER_OR_ADMIN,
} from "@/lib/auth/rbac";
import { AppError } from "@/lib/error/app-error";
import type { AuthRole } from "@/lib/db/enums";
import {
  createSessionCatSchema,
  createSessionSchema,
  editSessionSchema,
  getSessionCatsSchema,
  getSessionsSchema,
  getSessionUsersSchema,
} from "@/lib/validation/sessions";
import { editCatSchema } from "@/lib/validation/cats";
import { z } from "zod";

// SESSIONS
export const createSession = actionClient
  .schema(createSessionSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await service.createSession(parsedInput);
  });

export const getSessions = actionClient
  .schema(getSessionsSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await repo.findSessions(parsedInput);
  });

// Single authed call returning the session, its region name, and all its cats.
// Replaces getSessionCats + per-cat getCats on the create form (kills the N+1).
export const getSessionWithCats = actionClient
  .schema(z.object({ session_id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await service.getSessionWithCats(parsedInput.session_id);
  });

export const editSession = actionClient
  .schema(editSessionSchema)
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ parsedInput, bindArgsClientInputs: [id] }) => {
    await requireAuth();
    // Finishing a session promotes its still-Unsubmitted cats to Unreviewed
    // so the manager review queue surfaces them.
    if (parsedInput.is_finished === true) {
      return await service.finishSession(id);
    }
    return await repo.updateSession(id, parsedInput);
  });

export const removeSession = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    const current = await requireAuth();
    // Managers/Admins can discard any session; volunteers only their own.
    if (!hasRole(current.profile.auth_role as AuthRole, ...MANAGER_OR_ADMIN)) {
      const links = await repo.findSessionUsers({
        session_id: id,
        user_id: current.user.id,
      });
      if (links.length === 0) {
        throw new AppError("Forbidden: not your session", 403);
      }
    }
    return await service.discardSession(id);
  });

// SESSION CAT
export const createSessionCat = actionClient
  .schema(createSessionCatSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await service.createSessionCat(parsedInput);
  });

// Volunteers edit cats they captured while a session is still being built — that
// workflow is theirs, so this mirrors editCat but gates on auth instead of role
// (the database/review editCat stays Manager/Admin-only).
export const editSessionCat = actionClient
  .schema(editCatSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await catsService.editCat(parsedInput);
  });

export const getSessionCats = actionClient
  .schema(getSessionCatsSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await repo.findSessionCats(parsedInput);
  });

export const removeSessionCat = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    await requireAuth();
    return await service.removeSessionCat(id);
  });

// SESSION USERS
export const getSessionUsers = actionClient
  .schema(getSessionUsersSchema)
  .action(async ({ parsedInput }) => {
    await requireAuth();
    return await repo.findSessionUsers(parsedInput);
  });

export const removeSessionUser = actionClient
  .bindArgsSchemas([z.string().uuid()])
  .action(async ({ bindArgsClientInputs: [id] }) => {
    await requireRole(...MANAGER_OR_ADMIN);
    return await repo.deleteSessionUser(id);
  });
