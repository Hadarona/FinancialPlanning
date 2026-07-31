export function createBudgetController({ budgetService }) {
  return {
    /** GET /budget — the single budget's plans (no month, no actuals). */
    async getBudget(req, res, next) {
      try {
        const readModel = await budgetService.getBudget(req.user.id);
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },

    /** POST /budget — creates the default budget (409 if one exists). */
    async createBudget(req, res, next) {
      try {
        const readModel = await budgetService.createDefaultBudget(req.user.id);
        res.status(201).json(readModel);
      } catch (err) {
        next(err);
      }
    },

    /** PATCH /budget — partial update of income and/or planned amounts. */
    async patchBudget(req, res, next) {
      try {
        const readModel = await budgetService.patchBudget(req.user.id, req.body ?? {});
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },

    /** GET /months/:month — the single budget + that month's actuals. */
    async getMonth(req, res, next) {
      try {
        const readModel = await budgetService.getMonthReadModel(
          req.user.id,
          req.params.month,
        );
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },
  };
}
