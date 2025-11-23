// src/routes/carRoutes.js
import { Router } from "express";
import { publishToCar } from "../services/awsIotService.js";

const router = Router();

// Ví dụ: web gọi API để ra lệnh cho xe
router.post("/command", (req, res) => {
  const cmd = req.body;
  publishToCar("car/control", cmd);
  res.json({ success: true, sent: cmd });
});

export default router;