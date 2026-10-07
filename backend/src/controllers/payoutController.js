import PayoutOption from "../models/PayoutOption.js";

export async function methods(_req, res, next) {
  try {
    const rows = await PayoutOption.aggregate([
      { $match: { active: true } },
      { $group: {
        _id: "$method",
        name: { $first: "$name" },
        requiredDetails: { $first: "$requiredDetails" },
        options: { $sum: 1 }
      }},
      { $project: { _id: 0, method: "$_id", name: 1, requiredDetails: 1, options: 1 } }
    ]);
    res.json({ success: true, methods: rows });
  } catch (e) { next(e); }
}

export async function options(req, res, next) {
  try {
    const rows = await PayoutOption.find({ method: req.params.method, active: true })
      .select("methodId method name currency payoutCurrency payoutValue requiredAmount requiredDetails eligibility")
      .sort({ payoutValue: 1 })
      .lean();
    res.json({ success: true, options: rows });
  } catch (e) { next(e); }
}
