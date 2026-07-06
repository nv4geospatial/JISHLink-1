import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

router.get("/healthz", async (req, res) => {
  try {
    const { error } = await supabase.from("health_check").select("*").limit(1);
    res.json({ status: "ok", supabase: error ? "degraded" : "connected" });
  } catch {
    res.json({ status: "ok", supabase: "unreachable" });
  }
});

// Temporary seed endpoint - REMOVE AFTER USE
router.post("/seed-admin", async (req, res) => {
  try {
    const { id, email, role_id } = req.body;
    const { data, error } = await supabase
      .from("users")
      .insert([{ id, email, role_id }])
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;