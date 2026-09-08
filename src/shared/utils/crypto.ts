import crypto from 'crypto';
import { requireEnv } from './env';

/**
 * At-rest encryption for sensitive fields (aes-256-cbc).
 *
 * ENCRYPTION_KEY is mandatory. There is deliberately no fallback: a default
 * key checked into the repository would be public, so any deployment that
 * forgot the variable would encrypt production PII under a key an attacker
 * already has.
 *
 * Rotating the key makes existing ciphertext undecryptable — it needs a
 * re-encryption migration.
 */

const ALGORITHM = 'aes-256-cbc';

// Lazily evaluated so the key is only required once something is actually
// encrypted or decrypted, and so tests can set process.env before importing.
let _key: Buffer | null = null;
const getValidKey = (): Buffer => {
    if (!_key) {
        const secret = requireEnv(
            'ENCRYPTION_KEY',
            'Generate a 256-bit key: openssl rand -hex 32'
        );
        // Hash to a fixed 32 bytes so any key length works. This derivation
        // must not change: existing ciphertext is only decryptable with it.
        const derived = crypto
            .createHash('sha256')
            .update(secret)
            .digest('base64')
            .substring(0, 32);
        _key = Buffer.from(derived);
    }
    return _key;
};

export const encrypt = (text: string): string => {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getValidKey(), iv);
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
    const decipher = crypto.createDecipheriv(ALGORITHM, getValidKey(), iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
};
