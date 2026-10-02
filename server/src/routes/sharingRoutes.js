import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors.js";
import { validate } from "../middleware/validate.js";
const hash = (token) => createHash("sha256").update(token).digest("hex");
const route = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(["editor", "viewer"]),
  })
  .strict();

export function createSharingRoutes({ pool, requireAuth, budgetAccess }) {
  const router = Router();
  router.use(requireAuth);
  router.get(
    "/",
    route(async (req, res) => {
      const result = await pool.query(
        `SELECT b.id,u.email AS owner_email,b.currency_code,
      CASE WHEN b.user_id=$1 THEN 'owner' ELSE m.role END AS role
      FROM budgets b JOIN users u ON u.id=b.user_id LEFT JOIN budget_members m ON m.budget_id=b.id AND m.user_id=$1
      WHERE b.user_id=$1 OR m.user_id=$1 ORDER BY b.created_at`,
        [req.user.id],
      );
      res.json({ budgets: result.rows });
    }),
  );
  router.post(
    "/accept",
    validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
    route(async (req, res) => {
      const budgetId = await pool.withTransaction(async (db) => {
        const result = await db.query(
          "DELETE FROM budget_invites WHERE token_hash=$1 AND email=$2 AND expires_at>now() RETURNING *",
          [hash(req.body.token), req.user.email],
        );
        const invite = result.rows[0];
        if (!invite)
          throw new AppError(
            "NOT_FOUND",
            "Invitation expired or belongs to a different email.",
          );
        await db.query(
          `INSERT INTO budget_members VALUES ($1,$2,$3) ON CONFLICT (budget_id,user_id) DO UPDATE SET role=EXCLUDED.role`,
          [invite.budget_id, req.user.id, invite.role],
        );
        return invite.budget_id;
      });
      res.json({ budgetId });
    }),
  );
  router.use(budgetAccess);
  router.get(
    "/members",
    route(async (req, res) => {
      const members = await pool.query(
        `SELECT u.id,u.email,m.role FROM budget_members m JOIN users u ON u.id=m.user_id WHERE m.budget_id=$1`,
        [req.budgetId],
      );
      res.json({ members: members.rows, role: req.budgetRole });
    }),
  );
  router.use((req, res, next) =>
    req.budgetRole === "owner"
      ? next()
      : next(new AppError("FORBIDDEN", "Only the owner can manage sharing.")),
  );
  router.post(
    "/invite",
    validate(inviteSchema),
    route(async (req, res) => {
      if (req.body.email === req.user.email)
        throw new AppError("VALIDATION_ERROR", "You already own this budget.");
      const token = randomBytes(32).toString("hex");
      await pool.withTransaction(async (db) => {
        await db.query("DELETE FROM budget_invites WHERE budget_id=$1 AND email=$2", [
          req.budgetId,
          req.body.email,
        ]);
        await db.query(
          "INSERT INTO budget_invites(token_hash,budget_id,email,role) VALUES ($1,$2,$3,$4)",
          [hash(token), req.budgetId, req.body.email, req.body.role],
        );
      });
      res.status(201).json({ token, expiresInDays: 7 });
    }),
  );
  router.delete(
    "/members/:id",
    route(async (req, res) => {
      if (!z.string().uuid().safeParse(req.params.id).success)
        throw new AppError("NOT_FOUND", "Member not found.");
      await pool.query("DELETE FROM budget_members WHERE budget_id=$1 AND user_id=$2", [
        req.budgetId,
        req.params.id,
      ]);
      res.status(204).end();
    }),
  );
  return router;
}
