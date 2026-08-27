import { AppError } from "../errors.js";

export const SESSION_COOKIE_NAME = "bb_session";

/**
 * Express middleware factory: requires a valid session cookie, verifies the
 * JWT, loads the user, and attaches `req.user`. Missing, malformed, expired,
 * or otherwise invalid sessions all resolve to the same 401 (no distinction
 * that could leak account existence).
 */
export function createRequireAuth({ authService, userRepo }) {
  return async function requireAuth(req, res, next) {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      const payload = token ? authService.verifySession(token) : null;
      const userId = payload?.sub;
      const user = userId ? await userRepo.findById(userId) : null;

      if (!user) {
        throw new AppError("UNAUTHENTICATED", "Sign in required.");
      }

      req.user = { id: user.id, email: user.email };
      next();
    } catch (err) {
      next(err);
    }
  };
}
