import { httpRouter } from "convex/server";

const http = httpRouter();

// With Clerk authentication, HTTP routes are handled by Clerk
// No custom auth routes needed

export default http;
