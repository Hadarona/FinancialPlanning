export function createInsightsController({ insightsService }) {
  return {
    async getInsights(req, res, next) {
      try {
        const insights = await insightsService.getInsights(req.user.id, req.params.month);
        res.status(200).json(insights);
      } catch (err) {
        next(err);
      }
    },
  };
}
