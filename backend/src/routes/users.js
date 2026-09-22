const express = require("express");
const bcrypt = require("bcryptjs");

const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);

  const user = await insertRow("usuarios", {
    ...rest,
    passwordHash,
    verificationCode: code,
    verified: false,
  });
  delete user.passwordHash;
  res.json({ user, verificationCode: code });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.password) {
    body.passwordHash = await bcrypt.hash(body.password, 10);
  }
  delete body.password;

  const user = await updateRow("usuarios", req.params.id, body);
  delete user.passwordHash;
  res.json({ user });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("usuarios", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
