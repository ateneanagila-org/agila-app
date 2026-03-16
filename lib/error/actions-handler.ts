import { createSafeActionClient } from "next-safe-action";
import { AppError } from "@/lib/error/app-error";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("Action Error:", e);
    if (e instanceof AppError) {
      return e.message;
    }

    return "Something went wrong";
  },
});
