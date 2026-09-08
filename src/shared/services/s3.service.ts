import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

export class S3Service {
  private client: S3Client | null = null;
  private bucketName: string = "";

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.AWS_S3_BUCKET_NAME;

    if (region && accessKeyId && secretAccessKey && bucket) {
      this.bucketName = bucket;
      this.client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log(`[S3Service] Configured for AWS S3 bucket: ${this.bucketName}`);
    } else {
      console.warn(
        "[S3Service] AWS S3 credentials missing. Falling back to local upload."
      );
    }
  }

  async uploadFile(
    fileName: string,
    buffer: Buffer,
    mimeType: string = "application/octet-stream"
  ): Promise<string> {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const objectName = `${uniqueSuffix}-${fileName}`;

    if (!this.client) {
      return this.fallbackToLocal(objectName, buffer);
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectName,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.client.send(command);
      
      const region = process.env.AWS_REGION;
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${objectName}`;
    } catch (error: any) {
      console.warn("[S3Service] AWS S3 upload failed, falling back to local storage:", error.message);
      return this.fallbackToLocal(objectName, buffer);
    }
  }

  private fallbackToLocal(objectName: string, buffer: Buffer): string {
    const uploadDir = path.join(__dirname, "../../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, objectName);
    fs.writeFileSync(filePath, buffer);
    
    const host = process.env.APP_URL || `http://localhost:${process.env.PORT || 8080}`;
    return `${host}/uploads/${objectName}`;
  }
}
