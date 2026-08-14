/// <reference types="vite/client" />
// Shared module map for convex-test: keys must be relative to the convex/ root.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
