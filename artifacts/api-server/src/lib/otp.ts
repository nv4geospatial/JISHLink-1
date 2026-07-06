import crypto from "crypto";
import bcrypt from "bcryptjs";

/** Generate a 6-digit numeric OTP */
export function generateOtp(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

/** Hash an OTP for storage */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

/** Verify a plain OTP against its stored hash */
export async function verifyOtp(
  otp: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/** OTP expiry in minutes */
export const OTP_EXPIRY_MINUTES = 10;
