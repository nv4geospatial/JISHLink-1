import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/clients
router.get("/", requireAuth(["admin", "recruiter"]), async (req, res) => {
  try {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch clients");
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
router.post("/", requireAuth(["admin"]), async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, status } = req.body;
    const { data, error } = await supabase
      .from("clients")
      .insert([{ name, contact_person, email, phone, address, status }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err: any) {
    logger.error({ err }, "Failed to create client");
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clients/:id
router.put("/:id", requireAuth(["admin"]), async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, status } = req.body;
    const { data, error } = await supabase
      .from("clients")
      .update({ name, contact_person, email, phone, address, status })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    logger.error({ err }, "Failed to update client");
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id
router.delete("/:id", requireAuth(["admin"]), async (req, res) => {
  try {
    const { error } = await supabase.from("clients").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to delete client");
    res.status(500).json({ error: err.message });
  }
});

export default router;