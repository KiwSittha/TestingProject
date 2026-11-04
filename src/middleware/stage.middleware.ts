import type { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";
import { USER_STAGE } from "../config/business";
import { currentUser } from "./auth.middleware";
import { ApiError, dbCheck } from "../utils/errors";

async function loadStage(userId: string): Promise<string | null> {
  const row = dbCheck(
    await supabase
      .from("users")
      .select("current_stage")
      .eq("id", userId)
      .maybeSingle<{ current_stage: string | null }>(),
    "Load user stage"
  );
  return row?.current_stage ?? null;
}

export function requireStage(...allowedStages: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = currentUser(req);
    const stage = await loadStage(user.userId);
    if (!stage || !allowedStages.includes(stage)) {
      throw new ApiError("OPERATION_NOT_ALLOWED", "Operation is not allowed in the current stage");
    }
    next();
  };
}

export async function requirePaymentOrCartStage(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const user = currentUser(req);
  const stage = await loadStage(user.userId);
  const isPaymentResult = (req.body as { result?: unknown } | undefined)?.result !== undefined;
  const allowed = isPaymentResult ? USER_STAGE.PAYMENT : USER_STAGE.CART;

  if (stage !== allowed) {
    throw new ApiError("OPERATION_NOT_ALLOWED", "Operation is not allowed in the current stage");
  }
  next();
}
