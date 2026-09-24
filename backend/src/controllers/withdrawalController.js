import {
  createWithdrawal,
  listWithdrawals,
  getWithdrawal
} from "../services/withdrawalService.js";

export async function create(req, res, next) {
  try {
    const { method, optionId, payoutDetails } = req.body;
    const result = await createWithdrawal({
      userId: req.user._id,
      method,
      optionId,
      payoutDetails,
      idempotencyKey: req.headers["idempotency-key"],
      ip: req.ip
    });
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      message: result.duplicate
        ? "This withdrawal request has already been submitted."
        : "Withdrawal submitted successfully.",
      withdrawal: result.withdrawal
    });
  } catch (e) { next(e); }
}

export async function list(req, res, next) {
  try {
    res.json({ success: true, ...(await listWithdrawals(req.user._id, req.query.page, req.query.limit)) });
  } catch (e) { next(e); }
}

export async function detail(req, res, next) {
  try {
    res.json({ success: true, withdrawal: await getWithdrawal(req.user._id, req.params.id) });
  } catch (e) { next(e); }
}
