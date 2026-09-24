import Wallet from "../models/Wallet.js";
import { getWallet, getTransactions } from "../services/walletService.js";

export async function wallet(req, res, next) {
  try {
    const data = await getWallet(req.user._id);
    res.json({ success: true, wallet: data });
  } catch (e) { next(e); }
}

export async function summary(req, res, next) {
  try {
    const data = await getWallet(req.user._id);
    res.json({
      success: true,
      summary: {
        ves: data.ves,
        sves: data.sves,
        gems: data.gems,
        tokens: data.tokens,
        spins: data.spins
      }
    });
  } catch (e) { next(e); }
}

export async function transactions(req, res, next) {
  try {
    const data = await getTransactions(req.user._id, req.query.page, req.query.limit);
    res.json({ success: true, ...data });
  } catch (e) { next(e); }
}
