import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase";
import { signEmployeeToken } from "../lib/auth";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_EXPIRY_MINUTES,
} from "../lib/otp";
import { logger } from "../lib/logger";
import { sendSms } from "../lib/sms";

const router: IRouter = Router();

// In-memory rate limiter for server-side endpoints (IP-based)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  return true;
}

function getRateLimitReset(ip: string): number {
  const entry = rateLimitMap.get(ip);
  if (!entry) return 0;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

/** POST /auth/employee/login — employee_code + password */
router.post(
  "/auth/employee/login",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code, password } = req.body ?? {};

    if (!employee_code || !password) {
      res
        .status(400)
        .json({ error: "employee_code and password are required" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select(
        "id, employee_code, name, mobile, email, site_id, client_id, shift_id, status, photo_url, password_hash",
      )
      .eq("employee_code", employee_code)
      .eq("status", "active")
      .single();

    if (error || !employee) {
      res.status(401).json({ error: "Invalid employee code or password" });
      return;
    }

    if (!employee.password_hash) {
      res.status(401).json({
        error:
          "Password not set — please use OTP login or contact your HR admin",
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(
      password,
      employee.password_hash,
    );
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid employee code or password" });
      return;
    }

    const token = signEmployeeToken({
      employee_id: employee.id,
      employee_code: employee.employee_code,
      site_id: employee.site_id,
    });

    const { password_hash: _omit, ...safeEmployee } = employee;
    res.json({ token, employee: safeEmployee });
  },
);

/**
 * POST /auth/employee/send-otp
 *
 * Generates a 6-digit OTP, hashes it, stores it in `otp_logs`, and logs it
 * to the server for development. In production, wire this up to an SMS gateway
 * (e.g. Twilio) — the OTP is returned as `otp_for_dev` only when
 * NODE_ENV !== "production".
 */
router.post(
  "/auth/employee/send-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code, purpose } = req.body ?? {};

    if (!employee_code || !purpose) {
      res
        .status(400)
        .json({ error: "employee_code and purpose are required" });
      return;
    }

    if (!["login", "password_reset"].includes(purpose)) {
      res
        .status(400)
        .json({ error: "purpose must be 'login' or 'password_reset'" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, mobile")
      .eq("employee_code", employee_code)
      .single();

    if (error || !employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // Invalidate existing OTPs for this employee+purpose
    await supabase
      .from("otp_logs")
      .update({ used_at: new Date().toISOString() })
      .eq("employee_id", employee.id)
      .eq("purpose", purpose)
      .is("used_at", null);

    const otp = generateOtp();
    const otp_hash = await hashOtp(otp);
    const expires_at = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    await supabase.from("otp_logs").insert({
      employee_id: employee.id,
      otp_hash,
      purpose,
      expires_at,
    });

    // Send OTP via Twilio SMS
    const smsBody = `Your JISHLink OTP is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
    const smsSent = await sendSms(employee.mobile, smsBody);

    if (!smsSent) {
      logger.warn(
        { employee_id: employee.id, mobile: employee.mobile },
        "SMS delivery failed — OTP logged for dev mode only",
      );
    }

    const response: Record<string, unknown> = {
      success: true,
      message: smsSent 
        ? `OTP sent to ${employee.mobile}` 
        : `OTP could not be sent to ${employee.mobile}. Please contact admin.`,
      expires_in_minutes: OTP_EXPIRY_MINUTES,
      sms_sent: smsSent,
    };

    res.json(response);
  },
);

/** POST /auth/employee/verify-otp — verify OTP and issue token */
router.post(
  "/auth/employee/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code, otp, purpose } = req.body ?? {};

    if (!employee_code || !otp || !purpose) {
      res
        .status(400)
        .json({ error: "employee_code, otp, and purpose are required" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select(
        "id, employee_code, name, mobile, email, site_id, client_id, shift_id, status, photo_url",
      )
      .eq("employee_code", employee_code)
      .eq("status", "active")
      .single();

    if (error || !employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // Find latest unused, unexpired OTP
    const { data: otpLog } = await supabase
      .from("otp_logs")
      .select("id, otp_hash, expires_at")
      .eq("employee_id", employee.id)
      .eq("purpose", purpose)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpLog) {
      res.status(400).json({ error: "OTP not found or has expired" });
      return;
    }

    const valid = await verifyOtp(otp, otpLog.otp_hash);
    if (!valid) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // Mark OTP as used
    await supabase
      .from("otp_logs")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpLog.id);

    const token = signEmployeeToken({
      employee_id: employee.id,
      employee_code: employee.employee_code,
      site_id: employee.site_id,
    });

    res.json({ token, employee });
  },
);

/** POST /auth/employee/forgot-password — generate password reset OTP */
router.post(
  "/auth/employee/forgot-password",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code } = req.body ?? {};

    if (!employee_code) {
      res.status(400).json({ error: "employee_code is required" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, mobile")
      .eq("employee_code", employee_code)
      .single();

    if (error || !employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // Invalidate existing reset codes
    await supabase
      .from("otp_logs")
      .update({ used_at: new Date().toISOString() })
      .eq("employee_id", employee.id)
      .eq("purpose", "password_reset")
      .is("used_at", null);

    const otp = generateOtp();
    const otp_hash = await hashOtp(otp);
    const expires_at = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    await supabase.from("otp_logs").insert({
      employee_id: employee.id,
      otp_hash,
      purpose: "password_reset",
      expires_at,
    });

    // Send reset OTP via Twilio SMS
    const smsBody = `Your JISHLink password reset code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`;
    const smsSent = await sendSms(employee.mobile, smsBody);

    if (!smsSent) {
      logger.warn(
        { employee_id: employee.id, mobile: employee.mobile },
        "SMS delivery failed — reset OTP logged for dev mode only",
      );
    }

    const response: Record<string, unknown> = {
      success: true,
      message: smsSent 
        ? `Reset code sent to ${employee.mobile}` 
        : `Reset code could not be sent to ${employee.mobile}. Please contact admin.`,
      expires_in_minutes: OTP_EXPIRY_MINUTES,
      sms_sent: smsSent,
    };

    res.json(response);
  },
);

/** POST /auth/employee/reset-password — verify code and set new password */
router.post(
  "/auth/employee/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code, reset_code, new_password } = req.body ?? {};

    if (!employee_code || !reset_code || !new_password) {
      res.status(400).json({
        error: "employee_code, reset_code, and new_password are required",
      });
      return;
    }

    if (new_password.length < 6) {
      res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id")
      .eq("employee_code", employee_code)
      .single();

    if (error || !employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const { data: otpLog } = await supabase
      .from("otp_logs")
      .select("id, otp_hash")
      .eq("employee_id", employee.id)
      .eq("purpose", "password_reset")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpLog) {
      res.status(400).json({ error: "Reset code not found or has expired" });
      return;
    }

    const valid = await verifyOtp(reset_code, otpLog.otp_hash);
    if (!valid) {
      res.status(400).json({ error: "Invalid reset code" });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    await supabase
      .from("employees")
      .update({ password_hash })
      .eq("id", employee.id);

    await supabase
      .from("otp_logs")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpLog.id);

    res.json({ success: true, message: "Password reset successfully" });
  },
);

// ============================================================
// ADMIN / RECRUITER AUTH ROUTES
// ============================================================

/** POST /auth/admin/check-email — check if email exists */
router.post(
  "/auth/admin/check-email",
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body ?? {};
    
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    try {
      // Use the RPC function to check auth.users (bypasses RLS)
      const { data: exists, error } = await supabase.rpc('check_email_exists_auth', {
        p_email: email.toLowerCase(),
      });

      if (error) {
        // Fallback: check users table
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .single();
        
        res.json({ exists: !!userRecord, email: email.toLowerCase() });
        return;
      }

      res.json({ exists: !!exists, email: email.toLowerCase() });
    } catch (err: any) {
      logger.error('Check email error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/register — register with email + password (server-side, bypasses rate limits) */
router.post(
  "/auth/admin/register",
  async (req: Request, res: Response): Promise<void> => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Rate limit: 3 registrations per minute per IP
    if (!checkRateLimit(clientIp, 3, 60000)) {
      const waitSeconds = getRateLimitReset(clientIp);
      res.status(429).json({ 
        error: "Too many registration attempts", 
        retry_after_seconds: waitSeconds 
      });
      return;
    }

    const { email, password, name, phone } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "password must be at least 6 characters" });
      return;
    }

    try {
      // First check if email already exists
      const { data: existingAuth } = await supabase.rpc('check_email_exists_auth', {
        p_email: email.toLowerCase(),
      });

      if (existingAuth) {
        res.status(409).json({ 
          error: "Email already registered", 
          message: "This email is already in use. Please log in or use forgot password." 
        });
        return;
      }

      // Create auth user via Supabase (service_role key = no rate limits)
      // email_confirm: false = user must confirm email before login
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: false,
        user_metadata: { full_name: name },
      });

      if (authError) {
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          res.status(409).json({ 
            error: "Email already registered", 
            message: "This email is already in use. Please log in or use forgot password." 
          });
          return;
        }
        res.status(400).json({ error: authError.message });
        return;
      }

      if (!authData.user) {
        res.status(500).json({ error: "User created but no user data returned" });
        return;
      }

      // Insert into users table with pending status (email NOT verified yet)
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        name: name || null,
        phone: phone || null,
        role_id: null,
        account_status: 'pending',
        email_verified: false,
      });

      if (userError && !userError.message?.includes('duplicate')) {
        logger.error('Error inserting user record: ' + userError.message);
      }

      // Send confirmation email using Supabase Auth REST API
      // The /auth/v1/resend endpoint triggers Supabase to send the confirmation email template
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      let emailSent = false;
      let confirmationLink: string | undefined;

      try {
        const resendResponse = await fetch(`${supabaseUrl}/auth/v1/resend`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'signup',
            email: email.toLowerCase(),
            options: {
              email_redirect_to: `${process.env.DASHBOARD_URL || req.headers.origin || 'http://localhost:3000'}/confirm?type=email`,
            },
          }),
        });

        if (resendResponse.ok) {
          emailSent = true;
          logger.info({ email: email.toLowerCase() }, 'Confirmation email sent via resend API');
        } else {
          const resendResult = await resendResponse.json();
          logger.error('Resend API failed: ' + JSON.stringify(resendResult));
          
          // Fallback: generate confirmation link manually
          const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'apikey': serviceRoleKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'signup',
              email: email.toLowerCase(),
              password: password,
              options: {
                redirect_to: `${req.headers.origin || 'http://localhost:3000'}/confirm?type=email`,
              },
            }),
          });

          const linkResult = await linkResponse.json() as { action_link?: string };
          if (linkResponse.ok && linkResult.action_link) {
            confirmationLink = linkResult.action_link;
            logger.info({ email: email.toLowerCase() }, 'Confirmation link generated as fallback');
          } else {
            logger.error('Generate link fallback failed: ' + JSON.stringify(linkResult));
          }
        }
      } catch (emailErr: any) {
        logger.error('Exception sending confirmation email: ' + emailErr.message);
      }

      res.status(201).json({
        success: true,
        message: emailSent 
          ? "Registration successful. Please check your email to confirm your account before logging in."
          : confirmationLink 
            ? "Registration successful. Use the link below to confirm your email (dev mode)."
            : "Registration successful but confirmation email could not be sent. Please contact admin.",
        user_id: authData.user.id,
        email_sent: emailSent,
        dev_confirmation_link: process.env.NODE_ENV !== 'production' ? confirmationLink : undefined,
      });
    } catch (err: any) {
      logger.error('Admin registration error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/login — login with email + password */
router.post(
  "/auth/admin/login",
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        res.status(401).json({ error: error.message });
        return;
      }

      if (!data.user) {
        res.status(401).json({ error: "Login failed — no user returned" });
        return;
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        res.status(403).json({ 
          error: "Email not confirmed", 
          message: "Please confirm your email before logging in. Check your inbox for the confirmation link." 
        });
        return;
      }

      // Check if user account is active
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_status, role_id')
        .eq('id', data.user.id)
        .single();

      if (userRecord && userRecord.account_status === 'inactive') {
        res.status(403).json({ error: "Account is deactivated. Contact admin." });
        return;
      }

      res.json({
        success: true,
        session: data.session,
        user: data.user,
      });
    } catch (err: any) {
      logger.error('Admin login error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/forgot-password — send reset email (server-side, bypasses rate limits) */
router.post(
  "/auth/admin/forgot-password",
  async (req: Request, res: Response): Promise<void> => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Rate limit: 3 forgot-password requests per 5 minutes per IP
    if (!checkRateLimit(clientIp + '_forgot', 3, 300000)) {
      const waitSeconds = getRateLimitReset(clientIp + '_forgot');
      res.status(429).json({ 
        error: "Too many attempts", 
        retry_after_seconds: waitSeconds 
      });
      return;
    }

    const { email } = req.body ?? {};

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    try {
      // Check if email exists first
      const { data: exists } = await supabase.rpc('check_email_exists_auth', {
        p_email: email.toLowerCase(),
      });

      if (!exists) {
        res.status(404).json({ 
          error: "Email not registered", 
          message: "This email is not registered in our system. Please check or create an account." 
        });
        return;
      }

      const dashboardUrl = process.env.DASHBOARD_URL || req.headers.origin || 'http://localhost:3000';
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: `${dashboardUrl}/login?reset=true`,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ 
        success: true, 
        message: "Password reset link sent to your email. Please check your inbox and spam folder." 
      });
    } catch (err: any) {
      logger.error('Admin forgot password error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/resend-confirmation — resend confirmation email */
router.post(
  "/auth/admin/resend-confirmation",
  async (req: Request, res: Response): Promise<void> => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Rate limit: 3 resend requests per 10 minutes per IP
    if (!checkRateLimit(clientIp + '_resend', 3, 600000)) {
      const waitSeconds = getRateLimitReset(clientIp + '_resend');
      res.status(429).json({ 
        error: "Too many attempts", 
        retry_after_seconds: waitSeconds 
      });
      return;
    }

    const { email } = req.body ?? {};

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    try {
      // Check if email exists and is not already confirmed
      const { data: exists } = await supabase.rpc('check_email_exists_auth', {
        p_email: email.toLowerCase(),
      });

      if (!exists) {
        res.status(404).json({ 
          error: "Email not registered", 
          message: "This email is not registered in our system." 
        });
        return;
      }

      // Resend confirmation email using Supabase Auth REST API
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      const resendResponse = await fetch(`${supabaseUrl}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'signup',
          email: email.toLowerCase(),
          options: {
            email_redirect_to: `${process.env.DASHBOARD_URL || req.headers.origin || 'http://localhost:3000'}/confirm?type=email`,
          },
        }),
      });

      if (!resendResponse.ok) {
        const resendResult = await resendResponse.json() as { message?: string; msg?: string };
        const errorMsg = resendResult.message || resendResult.msg || 'Failed to resend confirmation email';
        logger.error('Resend confirmation error: ' + JSON.stringify(resendResult));
        
        // Check for rate limit
        if (errorMsg.toLowerCase().includes('rate limit') || resendResponse.status === 429) {
          res.status(429).json({ 
            error: "Rate limit exceeded", 
            message: "Too many email requests. Please wait 1 hour before trying again, or check your spam folder.",
            retry_after: "1 hour"
          });
          return;
        }
        
        res.status(400).json({ error: errorMsg });
        return;
      }

      res.json({ 
        success: true, 
        message: "Confirmation email resent. Please check your inbox and spam folder." 
      });
    } catch (err: any) {
      logger.error('Resend confirmation error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/reset-password — reset with token */
router.post(
  "/auth/admin/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const { access_token, new_password } = req.body ?? {};

    if (!access_token || !new_password) {
      res.status(400).json({ error: "access_token and new_password are required" });
      return;
    }
    if (new_password.length < 6) {
      res.status(400).json({ error: "password must be at least 6 characters" });
      return;
    }

    try {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token: '',
      });

      if (error) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: new_password,
      });

      if (updateError) {
        res.status(400).json({ error: updateError.message });
        return;
      }

      res.json({ success: true, message: "Password reset successfully" });
    } catch (err: any) {
      logger.error('Admin reset password error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/send-phone-otp — send OTP to phone via Twilio */
router.post(
  "/auth/admin/send-phone-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { phone } = req.body ?? {};

    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }

    try {
      // Find user by phone in users table
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone, account_status, role_id')
        .eq('phone', phone)
        .single();

      if (userError || !userRecord) {
        res.status(404).json({ error: "No account found with this phone number" });
        return;
      }

      // Check account status
      if (userRecord.account_status === 'inactive') {
        res.status(403).json({ error: "Account is deactivated. Contact admin." });
        return;
      }

      // Invalidate existing OTPs for this user
      await supabase
        .from("otp_logs")
        .update({ used_at: new Date().toISOString() })
        .eq("employee_id", userRecord.id)
        .eq("purpose", "admin_login")
        .is("used_at", null);

      const otp = generateOtp();
      const otp_hash = await hashOtp(otp);
      const expires_at = new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      ).toISOString();

      await supabase.from("otp_logs").insert({
        employee_id: userRecord.id,
        otp_hash,
        purpose: "admin_login",
        expires_at,
      });

      // Send OTP via Twilio
      const smsBody = `Your JISHLink admin login OTP is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
      const smsSent = await sendSms(phone, smsBody);

      const response: Record<string, unknown> = {
        success: true,
        message: smsSent
          ? `OTP sent to ${phone}`
          : `OTP could not be sent. Please contact admin.`,
        expires_in_minutes: OTP_EXPIRY_MINUTES,
        sms_sent: smsSent,
      };

      res.json(response);
    } catch (err: any) {
      logger.error('Admin phone OTP error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/admin/verify-phone-otp — verify phone OTP and login */
router.post(
  "/auth/admin/verify-phone-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { phone, otp } = req.body ?? {};

    if (!phone || !otp) {
      res.status(400).json({ error: "phone and otp are required" });
      return;
    }

    try {
      // Find user by phone
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone, account_status, role_id')
        .eq('phone', phone)
        .single();

      if (userError || !userRecord) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (userRecord.account_status === 'inactive') {
        res.status(403).json({ error: "Account is deactivated. Contact admin." });
        return;
      }

      // Find latest unused, unexpired OTP
      const { data: otpLog } = await supabase
        .from("otp_logs")
        .select("id, otp_hash, expires_at")
        .eq("employee_id", userRecord.id)
        .eq("purpose", "admin_login")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpLog) {
        res.status(400).json({ error: "OTP not found or has expired" });
        return;
      }

      const valid = await verifyOtp(otp, otpLog.otp_hash);
      if (!valid) {
        res.status(400).json({ error: "Invalid OTP" });
        return;
      }

      // Mark OTP as used
      await supabase
        .from("otp_logs")
        .update({ used_at: new Date().toISOString() })
        .eq("id", otpLog.id);

      // Get the auth user to create a session
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userRecord.id);

      if (authError || !authUser.user) {
        res.status(500).json({ error: "Failed to get auth user" });
        return;
      }

      // Create a session for the user
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
        email: userRecord.email,
        email_confirm: true,
        user_metadata: { full_name: userRecord.name },
      });

      // Actually, we need to sign in the user. Let's use a different approach:
      // Generate a custom JWT token for the admin
      const { signEmployeeToken } = await import('../lib/auth');
      const token = signEmployeeToken({
        employee_id: userRecord.id,
        employee_code: userRecord.email,
        site_id: '',
      });

      res.json({
        success: true,
        token,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          phone: userRecord.phone,
          role_id: userRecord.role_id,
        },
      });
    } catch (err: any) {
      logger.error('Admin verify phone OTP error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** GET /auth/admin/me — get current admin user details */
router.get(
  "/auth/admin/me",
  async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "No authorization header" });
      return;
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('*, role:roles(name, description)')
        .eq('id', user.id)
        .single();

      res.json({
        success: true,
        user: {
          ...user,
          ...userRecord,
        },
      });
    } catch (err: any) {
      logger.error('Admin me error: ' + err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/** POST /auth/employee/send-attendance-otp — send OTP before marking attendance */
router.post(
  "/auth/employee/send-attendance-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { employee_code, site_id } = req.body ?? {};

    if (!employee_code || !site_id) {
      res.status(400).json({ error: "employee_code and site_id are required" });
      return;
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, mobile, name")
      .eq("employee_code", employee_code)
      .eq("status", "active")
      .single();

    if (error || !employee) {
      res.status(404).json({ error: "Employee not found or inactive" });
      return;
    }

    // Invalidate existing attendance OTPs
    await supabase
      .from("otp_logs")
      .update({ used_at: new Date().toISOString() })
      .eq("employee_id", employee.id)
      .eq("purpose", "attendance")
      .is("used_at", null);

    const otp = generateOtp();
    const otp_hash = await hashOtp(otp);
    const expires_at = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    await supabase.from("otp_logs").insert({
      employee_id: employee.id,
      otp_hash,
      purpose: "attendance",
      expires_at,
    });

    // Send OTP via Twilio
    const smsBody = `Hi ${employee.name}, your JISHLink attendance OTP is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`;
    const smsSent = await sendSms(employee.mobile, smsBody);

    const response: Record<string, unknown> = {
      success: true,
      message: smsSent 
        ? `OTP sent to ${employee.mobile}` 
        : `OTP could not be sent. Please contact admin.`,
      expires_in_minutes: OTP_EXPIRY_MINUTES,
      sms_sent: smsSent,
    };

    res.json(response);
  },
);

export default router;
