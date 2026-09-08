import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export class SmsService {
  private client: SNSClient | null = null;
  private topicArn: string = "";

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const topicArn = process.env.AWS_SNS_TOPIC_ARN;

    if (region && accessKeyId && secretAccessKey && topicArn) {
      this.client = new SNSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.topicArn = topicArn;
    } else {
      console.warn(
        "[SmsService] AWS SNS credentials or Topic ARN missing. Falling back to console logging.",
      );
    }
  }

  async sendVerificationSms(to: string, code: string): Promise<void> {
    const phoneNumber = parsePhoneNumberFromString(to);
    
    if (!phoneNumber || !phoneNumber.isValid()) {
      throw new Error("Invalid phone number format. Please ensure it includes the country code (e.g. +1... or +880...).");
    }
    
    const formattedTo = phoneNumber.format('E.164');
    const message = `Your Freigenta verification code is: ${code}. Valid for 10 minutes.`;

    if (this.client) {
      try {
        const command = new PublishCommand({
          TopicArn: this.topicArn,
          Message: message,
          MessageAttributes: {
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional",
            },
            // For End User Messaging / WhatsApp, specific attributes or payloads might be required here.
            // Using standard Publish to Topic for now.
          },
        });
        await this.client.send(command);
      } catch (error: any) {
        console.error("[SmsService] Failed to send message via AWS SNS:", error.message);
        throw new Error("Failed to send verification message. Please try again later.");
      }
    } else {
      console.log(
        `[SmsService MOCK] Sending verification message to ${formattedTo}. Message: ${message}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}
