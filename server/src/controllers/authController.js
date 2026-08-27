import { AppError } from "../errors.js";
import { SESSION_COOKIE_NAME } from "../middleware/auth.js";

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createAuthController({ authService, config }) {
  function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });
  }

  return {
    async register(req, res, next) {
      try {
        const user = await authService.register(req.body);
        const token = authService.signSession(user);
        setSessionCookie(res, token);
        res.status(201).json({ user });
      } catch (err) {
        next(err);
      }
    },

    async login(req, res, next) {
      try {
        const user = await authService.login(req.body);
        const token = authService.signSession(user);
        setSessionCookie(res, token);
        res.status(200).json({ user });
      } catch (err) {
        next(err);
      }
    },

    async logout(req, res) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.status(204).end();
    },

    async me(req, res, next) {
      try {
        if (!req.user) {
          throw new AppError("UNAUTHENTICATED", "Sign in required.");
        }
        res.status(200).json({ user: req.user });
      } catch (err) {
        next(err);
      }
    },
  };
}
