import { encrypt, decrypt } from './src/shared/utils/crypto';

const originalText = "22233344455";
console.log("Original: ", originalText);

const encrypted = encrypt(originalText);
console.log("Encrypted: ", encrypted);

const decrypted = decrypt(encrypted);
console.log("Decrypted: ", decrypted);

if (originalText === decrypted) {
    console.log("SUCCESS: Encryption and Decryption work perfectly.");
} else {
    console.error("FAILED: Decrypted text does not match original.");
}
