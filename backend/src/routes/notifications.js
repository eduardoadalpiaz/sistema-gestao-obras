const express = require("express");
const { pool } = require("../db");
const { insertRow, updateRowNoTimestamp } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const notification = await insertRow("notificacoes", req.body);
  res.json({ notification });
}));

router.put("/mark-all-read", asyncHandler(async (_req, res) => {
  await pool.query("UPDATE notificacoes SET read = TRUE WHERE read = FALSE");
  res.json({ success: true });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const notification = await updateRowNoTimestamp("notificacoes", req.params.id, req.body);
  res.json({ notification });
}));

module.exports = router;
