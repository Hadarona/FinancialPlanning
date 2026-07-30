export function createTransactionController({ transactionService }) {
  return {
    async create(req, res, next) {
      try {
        const { transaction, existed } = await transactionService.createTransaction(
          req.user.id,
          req.params.month,
          req.body,
        );
        // Idempotent retry (same clientRequestId) returns the existing row
        // with 200 instead of creating a duplicate (decision #8).
        res.status(existed ? 200 : 201).json({ transaction });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await transactionService.deleteTransaction(
          req.user.id,
          req.params.month,
          req.params.id,
        );
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const result = await transactionService.listTransactions(
          req.user.id,
          req.params.month,
          req.validatedQuery,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}
