import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { credit, debit, process, approve, reject, withdrawals, withdrawalDetail, adminStats, updatePayoutOption } from "../controllers/adminController.js";
import { validateAdminWalletMutation, validatePagination, validateWithdrawalReview, validatePayoutOptionUpdate, validateWithdrawalId } from "../validators/requests.js";
import { body, query } from "express-validator";
import { validateRequest } from "../validators/requests.js";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/stats", adminStats);
router.patch("/payout-options/:methodId", validatePayoutOptionUpdate, updatePayoutOption);
router.post("/wallet/credit", validateAdminWalletMutation, credit);
router.post("/wallet/debit", validateAdminWalletMutation, debit);
router.get("/withdrawals", [
  query("status").optional().isIn(["PENDING", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"]),
  validateRequest, validatePagination
], withdrawals);
router.get("/withdrawals/:id", validateWithdrawalId, withdrawalDetail);
router.post("/withdrawals/:id/process", [
  ...validateWithdrawalId.slice(0, 1),
  body("note").optional().isString().trim().isLength({ max: 1000 }),
  validateRequest
], process);
router.post("/withdrawals/:id/approve", [
  ...validateWithdrawalId.slice(0, 1),
  body("note").optional().isString().trim().isLength({ max: 1000 }),
  validateRequest
], approve);
router.post("/withdrawals/:id/reject", validateWithdrawalReview, reject);
export default router;


