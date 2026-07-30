export function createBudgetController({ budgetService }) {
  return {
    async getBudget(req, res, next) {
      try {
        const readModel = await budgetService.getBudgetReadModel(req.user.id, req.params.month);
        res.status(200).json(readModel);
      } catch (err) {
        next(err);
      }
    },
  };
}
