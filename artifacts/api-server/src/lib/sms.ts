import twilio from "twilio";
import { logger } from "./logger";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const defaultCountryCode = process.env.TWILIO_DEFAULT_COUNTRY_CODE || "91";

let client: twilio.Twilio | null = null;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  logger.warn("Twilio credentials not configured — SMS will not be sent");
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, "");
  
  // If already starts with +, return as-is
  if (phone.startsWith("+")) {
    return phone;
  }
  
  // If 10 digits (Indian mobile without country code), add +91
  if (digitsOnly.length === 10) {
    return `+${defaultCountryCode}${digitsOnly}`;
  }
  
  // If already includes country code (e.g., 919353729660 = 12 digits), add + prefix
  if (digitsOnly.length > 10) {
    return `+${digitsOnly}`;
  }
  
  // Fallback: just add + prefix
  return `+${digitsOnly}`;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!client || !fromNumber) {
    logger.warn("Twilio not configured — SMS skipped");
    return false;
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: formattedTo,
    });

    logger.info({ sid: message.sid, to: formattedTo }, "SMS sent via Twilio");
    return true;
  } catch (err: any) {
    logger.error({ error: err.message, to, formattedTo: formatPhoneNumber(to) }, "Failed to send SMS via Twilio");
    return false;
  }
}