import express, { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { parseWorkbook } from "../services/excelImport.js";
const route = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};
const commitSchema = z
  .object({
    previewId: z.string().uuid(),
    rows: z
      .array(
        z
          .object({
            index: z.number().int().nonnegative(),
            categoryId: z.string().min(1).max(50),
            allowManualMatch: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();

export function createImportRoutes({ pool, requireAuth, budgetAccess, budgetRepo }) {
  const router = Router();
  router.use(requireAuth, budgetAccess);
  router.post(
    "/preview",
    express.raw({
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      limit: "5mb",
    }),
    route(async (req, res) => {
      if (req.query.dateBasis && !["purchase", "billing"].includes(req.query.dateBasis))
        throw new AppError("VALIDATION_ERROR", "Choose purchase or billing date.");
      const parsed = await parseWorkbook(req.body, {
        dateBasis: req.query.dateBasis ?? "purchase",
      });
      const existing = await pool.query(
        "SELECT import_key FROM transactions WHERE user_id=$1 AND import_key=ANY($2::text[])",
        [req.budgetOwnerId, parsed.rows.map((r) => r.importKey)],
      );
      const duplicates = new Set(existing.rows.map((r) => r.import_key));
      const manual = await pool.query(
        `SELECT id, occurred_on::text AS date, amount_minor, note
         FROM transactions WHERE user_id=$1 AND import_key IS NULL
         AND occurred_on=ANY($2::date[]) ORDER BY created_at, id`,
        [
          req.budgetOwnerId,
          parsed.rows.map((r) => r.metadata.purchaseDate ?? r.occurredOn),
        ],
      );
      const manualByDateAndAmount = new Map();
      for (const expense of manual.rows) {
        const key = `${expense.date}:${expense.amount_minor}`;
        if (!manualByDateAndAmount.has(key)) manualByDateAndAmount.set(key, []);
        manualByDateAndAmount.get(key).push({ id: expense.id, note: expense.note });
      }
      const rows = parsed.rows.map((row) => ({
        ...row,
        duplicate: duplicates.has(row.importKey),
        manualMatches:
          manualByDateAndAmount.get(
            `${row.metadata.purchaseDate ?? row.occurredOn}:${row.amountMinor}`,
          ) ?? [],
      }));
      await pool.query(
        "DELETE FROM import_previews WHERE expires_at<now() OR user_id=$1",
        [req.user.id],
      );
      const result = await pool.query(
        "INSERT INTO import_previews(budget_id,user_id,rows) VALUES ($1,$2,$3::jsonb) RETURNING id",
        [req.budgetId, req.user.id, JSON.stringify(rows)],
      );
      const versions = new Map();
      for (const month of new Set(rows.map((row) => row.occurredOn.slice(0, 7)))) {
        versions.set(
          month,
          (await budgetRepo.findByUser(req.budgetOwnerId, month)).categories,
        );
      }
      // Offer only categories that exist in every month for each source group.
      const categoryOptions = {};
      for (const source of new Set(rows.map((row) => row.metadata.sourceCategory))) {
        const months = [
          ...new Set(
            rows
              .filter((row) => row.metadata.sourceCategory === source)
              .map((row) => row.occurredOn.slice(0, 7)),
          ),
        ];
        categoryOptions[source] = versions
          .get(months[0])
          .filter(
            (category) =>
              !category.archived &&
              months.every((month) =>
                versions.get(month).some((c) => c.id === category.id && !c.archived),
              ),
          );
      }
      res.json({
        previewId: result.rows[0].id,
        rows,
        issues: parsed.issues,
        categoryOptions,
      });
    }),
  );
  router.post(
    "/commit",
    validate(commitSchema),
    route(async (req, res) => {
      if (new Set(req.body.rows.map((r) => r.index)).size !== req.body.rows.length)
        throw new AppError("VALIDATION_ERROR", "Select each row once.");
      const result = await pool.withTransaction(async (db) => {
        await db.query("SELECT id FROM budgets WHERE id=$1 FOR SHARE", [req.budgetId]);
        const preview = await db.query(
          "SELECT rows FROM import_previews WHERE id=$1 AND user_id=$2 AND budget_id=$3 AND expires_at>now() FOR UPDATE",
          [req.body.previewId, req.user.id, req.budgetId],
        );
        if (!preview.rows[0])
          throw new AppError("NOT_FOUND", "Preview expired. Choose the file again.");
        let imported = 0,
          duplicates = 0;
        const versions = new Map();
        for (const selected of req.body.rows) {
          const row = preview.rows[0].rows[selected.index];
          if (!row) throw new AppError("VALIDATION_ERROR", "Invalid preview row.");
          // Recheck at confirmation: a household member may have added an
          // expense since the preview. Only an explicitly reviewed match may
          // be imported anyway; previously unseen matches are safely skipped.
          const manual = await db.query(
            `SELECT id FROM transactions WHERE user_id=$1 AND import_key IS NULL
             AND occurred_on=$2 AND amount_minor=$3`,
            [
              req.budgetOwnerId,
              row.metadata.purchaseDate ?? row.occurredOn,
              row.amountMinor,
            ],
          );
          if (
            manual.rows.some(
              (expense) =>
                !selected.allowManualMatch ||
                !row.manualMatches?.some((match) => match.id === expense.id),
            )
          ) {
            duplicates++;
            continue;
          }
          const month = row.occurredOn.slice(0, 7);
          if (!versions.has(month))
            versions.set(
              month,
              await budgetRepo.findByUser(req.budgetOwnerId, month, db),
            );
          const category = versions
            .get(month)
            ?.categories.find((c) => c.id === selected.categoryId && !c.archived);
          if (!category)
            throw new AppError(
              "VALIDATION_ERROR",
              `Choose a category available in ${month}.`,
            );
          const inserted = await db.query(
            `INSERT INTO transactions(user_id,category_id,amount_minor,occurred_on,note,import_key,metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (user_id,import_key) WHERE import_key IS NOT NULL DO NOTHING RETURNING id`,
            [
              req.budgetOwnerId,
              selected.categoryId,
              row.amountMinor,
              row.occurredOn,
              row.note,
              row.importKey,
              JSON.stringify(row.metadata),
            ],
          );
          if (inserted.rowCount) imported++;
          else duplicates++;
        }
        return { imported, duplicates };
      });
      res.json(result);
    }),
  );
  return router;
}
