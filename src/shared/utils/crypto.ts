import crypto from 'crypto';

// The encryption key should ideally be 32 bytes for aes-256-cbc.
// We use a fallback for sandbox/development if not provided in .env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sandbox_encryption_key_32_bytes!'; 
const ALGORITHM = 'aes-256-cbc';

// Ensure the key is exactly 32 bytes long by padding or truncating
const getValidKey = () => {
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
};

export const encrypt = (text: string): string => {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getValidKey()), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text: string): string => {
    if (!text) return text;
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) return text;
    
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(getValidKey()), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
};
