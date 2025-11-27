import { mutation } from "./_generated/server";

// Seed admin user - run this once to create default admin
// With Clerk, password is managed by Clerk. This just creates the user in Convex.
export const seedAdminUser = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Check if admin already exists
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@techcorp.com"))
      .first();

    if (existingAdmin) {
      return {
        success: true,
        message: "Admin user already exists. Sign up with Clerk using this email.",
        email: "admin@techcorp.com"
      };
    }

    // Check if company exists, create if not
    let company = await ctx.db
      .query("companies")
      .withIndex("by_contact_email", (q) => q.eq("contactEmail", "admin@techcorp.com"))
      .first();

    if (!company) {
      const companyId = await ctx.db.insert("companies", {
        name: "TechCorp Language Academy",
        contactEmail: "admin@techcorp.com",
        isActive: true,
        currentStudentCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
    }

    if (!company) {
      throw new Error("Failed to create company");
    }

    // Create admin user (password will be managed by Clerk)
    const adminUserId = await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@techcorp.com",
      role: "corporate_admin",
      companyId: company._id,
      isActive: true,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: "Admin user created. Sign up with Clerk using this email.",
      email: "admin@techcorp.com",
      userId: adminUserId,
      companyId: company._id
    };
  },
});

