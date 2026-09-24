import { body, param, query, validationResult } from "express-validator";

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Request validation failed.",
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
    });
  }
  next();
}

const supportedMethods = ["upi", "paypal", "amazon", "google_play"];
const optionIdPattern = /^(upi|paypal|amazon|google_play)_\d{1,6}$/;
const withdrawalIdPattern = /^wd_[0-9a-f-]{36}$/i;

export const validateRegister = [
  body("name").isString().trim().isLength({ min: 1, max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 10, max: 128 }),
  validateRequest
];

export const validateLogin = [
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 1, max: 128 }),
  validateRequest
];

export const validateWithdrawal = [
  body("method").isIn(supportedMethods),
  body("optionId").isString().trim().matches(optionIdPattern),
  body("payoutDetails").isObject({ strict: true }),
  validateRequest
];

export const validatePagination = [
  query("page").optional().isInt({ min: 1, max: 100000 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest
];

export const validateMethod = [
  param("method").isIn(supportedMethods),
  validateRequest
];

export const validateAdminWalletMutation = [
  body("userId").isMongoId(),
  body("currency").isIn(["VES", "SVES", "GEMS", "TOKENS", "SPINS"]),
  body("amount").isInt({ min: 1, max: 100000000 }).toInt(),
  body("description").optional().isString().trim().isLength({ max: 500 }),
  validateRequest
];

export const validateWithdrawalReview = [
  param("id").isString().matches(withdrawalIdPattern),
  body("reason").optional().isString().trim().isLength({ min: 1, max: 500 }),
  body("note").optional().isString().trim().isLength({ max: 1000 }),
  validateRequest
];

export const validateWithdrawalId = [
  param("id").isString().matches(withdrawalIdPattern),
  validateRequest
];

export const validatePayoutOptionUpdate = [
  param("methodId").isString().matches(optionIdPattern),
  body("name").optional().isString().trim().isLength({ min: 1, max: 100 }),
  body("payoutValue").optional().isInt({ min: 1, max: 1000000 }).toInt(),
  body("requiredAmount").optional().isInt({ min: 1, max: 100000000 }).toInt(),
  body("active").optional().isBoolean().toBoolean(),
  body().custom((_value, { req }) => {
    const fields = ["name", "payoutValue", "requiredAmount", "active"];
    if (!fields.some(field => Object.hasOwn(req.body || {}, field))) {
      throw new Error("At least one configurable field is required.");
    }
    return true;
  }),
  validateRequest
];
