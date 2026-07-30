export function createBudgetController({ budgetService }) {
  return {
    async getBudget(req, res, next) {
      try {
        const readModel = await budgetService.getBudgetReadModel(
          req.user.id,
          req.params.month,
        );
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },

    async createBudget(req, res, next) {
      try {
        const readModel = await budgetService.createBudget(req.user.id, req.body);
        res.status(201).json(readModel);
      } catch (err) {
        next(err);
      }
    },

    async updateBudget(req, res, next) {
      try {
        const readModel = await budgetService.updateBudget(
          req.user.id,
          req.params.month,
          req.body,
        );
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },
  };
}
