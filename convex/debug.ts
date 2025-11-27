import { query } from "./_generated/server";

export const getAuthData = query({
  args: {},
  handler: async (ctx) => {
    const authAccounts = await ctx.db.query("authAccounts").collect();
    const authSessions = await ctx.db.query("authSessions").collect();
    const users = await ctx.db.query("users").collect();

    return {
      authAccounts,
      authSessions,
      users: users.map(u => ({ _id: u._id, email: u.email, name: u.name, role: u.role, companyId: u.companyId })),
    };
  },
});

export const getIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity;
  },
});
