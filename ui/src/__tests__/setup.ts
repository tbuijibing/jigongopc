import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for tests (required by Radix UI ScrollArea)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
