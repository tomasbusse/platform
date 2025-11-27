import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Simple password hashing using Web Crypto API (server context)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Seed admin user - run this once to create default admin
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
      // If admin exists but has no password, set one
      if (!existingAdmin.passwordHash || existingAdmin.passwordHash === "") {
        const passwordHash = await hashPassword("admin123");
        await ctx.db.patch(existingAdmin._id, {
          passwordHash: passwordHash,
          isActive: true,
          updatedAt: now,
        });
        return {
          success: true,
          message: "Admin user password has been set",
          credentials: {
            email: "admin@techcorp.com",
            password: "admin123"
          }
        };
      }
      return {
        success: true,
        message: "Admin user already exists with password set. You can log in.",
        credentials: {
          email: "admin@techcorp.com",
          password: "admin123"
        }
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
        subscriptionPlan: "professional",
        subscriptionStatus: "active",
        maxStudents: 100,
        currentStudentCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      company = await ctx.db.get(companyId);
    }

    if (!company) {
      throw new Error("Failed to create company");
    }

    // Hash the default password: "admin123"
    const passwordHash = await hashPassword("admin123");

    // Create admin user
    const adminUserId = await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@techcorp.com",
      passwordHash: passwordHash,
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
      message: "Admin user created successfully",
      credentials: {
        email: "admin@techcorp.com",
        password: "admin123"
      },
      userId: adminUserId,
      companyId: company._id
    };
  },
});

