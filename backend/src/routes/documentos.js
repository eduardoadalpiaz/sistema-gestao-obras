const express = require("express");
const { insertRow, updateRowNoTimestamp, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const documento = await insertRow("documentos_obra", req.body);
  res.json({ documento });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const documento = await updateRowNoTimestamp("documentos_obra", req.params.id, req.body);
  res.json({ documento });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("documentos_obra", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
