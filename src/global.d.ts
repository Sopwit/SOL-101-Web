import type { Buffer as BufferType } from 'buffer/';

declare global {
  interface Window {
    Buffer: typeof BufferType;
  }
  
  // Ensure global namespace has Buffer
  const Buffer: typeof BufferType;
}

export {};