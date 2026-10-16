import { customAlphabet } from "nanoid";

const ALPHABET ="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // Base62

export const generateCode = customAlphabet(ALPHABET,7);