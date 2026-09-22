const express = require("express");
const { insertRow, updateRowNoTimestamp, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const gasto = await insertRow("despesas_obra", req.body);
  res.json({ gasto });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const gasto = await updateRowNoTimestamp("despesas_obra", req.params.id, req.body);
  res.json({ gasto });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("despesas_obra", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
