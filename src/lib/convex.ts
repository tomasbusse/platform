import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL environment variable is not defined. " +
    "Please add it to your .env.local file. " +
    "Run 'npx convex dev' to get your deployment URL."
  );
}

export const convexClient = new ConvexReactClient(convexUrl);
