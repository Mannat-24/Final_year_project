import express from "express";
import { realtimeStream } from "../controllers/realtimeController.js";

const router = express.Router();

router.get("/stream", realtimeStream);

export default router;
