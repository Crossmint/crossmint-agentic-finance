// Polyfills must be imported first, before any other code
import { Buffer } from "buffer";
import process from "process";

// Set up global Buffer - make it available everywhere modules might look
const globalObj = typeof globalThis !== "undefined" ? globalThis :
                  typeof window !== "undefined" ? window :
                  typeof global !== "undefined" ? global :
                  typeof self !== "undefined" ? self : {};

(globalObj as any).Buffer = Buffer;

// Also set on window and globalThis explicitly
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// Set up global process
(globalObj as any).process = process;
if (typeof window !== "undefined") {
  (window as any).process = process;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).process = process;
}

// Export for explicit imports if needed
export { Buffer, process };

