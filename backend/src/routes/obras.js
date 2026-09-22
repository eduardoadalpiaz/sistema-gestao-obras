const express = require("express");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const obra = await insertRow("obras", req.body);
  res.json({ obra });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const obra = await updateRow("obras", req.params.id, req.body);
  res.json({ obra });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  // ON DELETE CASCADE no banco apaga etapas, gastos e documentos automaticamente
  await deleteRow("obras", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
