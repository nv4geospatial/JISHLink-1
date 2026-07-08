import { Router, type IRouter, type Request, type Response } from "express";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";
import { requireRole } from "../lib/rbac";
import crypto from "crypto";

const router: IRouter = Router();

/** POST /qr/generate/:siteId — generate/regenerate site QR code (Admin only) */
router.post(
  "/qr/generate/:siteId",
  async (req: Request, res: Response): Promise<void> => {
    // Only admins can generate QR codes
    const authed = await requireRole(req, res, ["admin"]);
    if (!authed) return;

    const { siteId } = req.params;

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, name")
      .eq("id", siteId)
      .single();

    if (siteError || !site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    // Generate a new secure token
    const qrToken = crypto.randomBytes(16).toString("hex");
    const appUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.PROD_MOBILE_APP_URL || process.env.MOBILE_APP_URL || "https://jishlink.com/mobile";
    const deepLink = `${appUrl}/attend/${qrToken}`;

    // Generate QR as PNG data URL
    const qrDataUrl = await QRCode.toDataURL(deepLink, {
      width: 400,
      margin: 2,
      color: { dark: "#0B3B63", light: "#FFFFFF" },
    });

    // Convert data URL to buffer and upload to Supabase Storage
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const filePath = `site-qr-codes/${siteId}.png`;

    let qrCodeUrl = qrDataUrl; // Fallback to data URL if storage fails
    const { error: uploadError } = await supabase.storage
      .from("site-qr-codes")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("site-qr-codes")
        .getPublicUrl(filePath);
      if (urlData.publicUrl) qrCodeUrl = urlData.publicUrl;
    }

    // Update site record
    await supabase
      .from("sites")
      .update({ qr_token: qrToken, qr_code_image_url: qrCodeUrl })
      .eq("id", siteId);

    // Deactivate previous QR codes for this site
    await supabase
      .from("qr_codes")
      .update({ is_active: false })
      .eq("site_id", siteId);

    // Log new QR code
    await supabase.from("qr_codes").insert({
      site_id: siteId,
      code_value: qrToken,
      generated_at: new Date().toISOString(),
      is_active: true,
    });

    res.json({
      qr_code_url: qrCodeUrl,
      qr_token: qrToken,
      site_id: siteId,
      expires_at: null,
    });
  },
);

export default router;
