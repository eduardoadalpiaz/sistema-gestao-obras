const express = require("express");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const stage = await insertRow("etapas", req.body);
  res.json({ stage });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const stage = await updateRow("etapas", req.params.id, req.body);
  res.json({ stage });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("etapas", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
