import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// COMPANY CRUD OPERATIONS (for super-admin)
// ============================================================================

// Get all companies (super-admin only)
export const getAllCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        // Count users
        const users = await ctx.db
          .query("users")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .collect();

        // Count groups
        const groups = await ctx.db
          .query("groups")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .collect();

        // Count teachers
        const teachers = users.filter(u => u.role === "teacher").length;
        const students = users.filter(u => u.role === "student").length;
        const activeGroups = groups.filter(g => g.isActive).length;

        return {
          ...company,
          stats: {
            totalUsers: users.length,
            teachers,
            students,
            totalGroups: activeGroups,
          }
        };
      })
    );

    return companiesWithStats;
  },
});

// Get a single company with full details
export const getCompanyDetails = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company) return null;

    // Get users
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    // Get groups
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    // Get teachers with their groups
    const teachers = await Promise.all(
      users
        .filter(u => u.role === "teacher")
        .map(async (teacher) => {
          const teacherGroups = groups.filter(g => g.teacherId === teacher._id);
          return {
            ...teacher,
            groups: teacherGroups.map(g => ({ _id: g._id, name: g.name, level: g.level })),
          };
        })
    );

    return {
      ...company,
      users,
      groups,
      teachers,
      stats: {
        totalUsers: users.length,
        teachers: teachers.length,
        students: users.filter(u => u.role === "student").length,
        totalGroups: groups.filter(g => g.isActive).length,
      }
    };
  },
});

// Create a new company (super-admin only)
export const createCompany = mutation({
  args: {
    name: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if company with same name or email exists
    const existingByEmail = await ctx.db
      .query("companies")
      .withIndex("by_contact_email", (q) => q.eq("contactEmail", args.contactEmail))
      .first();

    if (existingByEmail) {
      throw new Error("A company with this contact email already exists");
    }

    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      domain: args.domain,
      description: args.description,
      isActive: true,
      currentStudentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId,
      action: "company_created",
      entityType: "company",
      entityId: companyId,
      newValues: { name: args.name, contactEmail: args.contactEmail },
      timestamp: now,
    });

    return companyId;
  },
});

// Update a company (super-admin only)
export const updateCompany = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    domain: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const company = await ctx.db.get(args.companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    const oldValues = { ...company };

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (args.name !== undefined) updateData.name = args.name;
    if (args.contactEmail !== undefined) updateData.contactEmail = args.contactEmail;
    if (args.contactPhone !== undefined) updateData.contactPhone = args.contactPhone;
    if (args.domain !== undefined) updateData.domain = args.domain;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    await ctx.db.patch(args.companyId, updateData);

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "company_updated",
      entityType: "company",
      entityId: args.companyId,
      oldValues,
      newValues: updateData,
      timestamp: now,
    });

    return { success: true };
  },
});

// Delete (deactivate) a company (super-admin only)
export const deleteCompany = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const company = await ctx.db.get(args.companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    // Soft delete - set isActive to false
    await ctx.db.patch(args.companyId, {
      isActive: false,
      updatedAt: now,
    });

    // Deactivate all users in the company
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    for (const user of users) {
      await ctx.db.patch(user._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    // Deactivate all groups
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    for (const group of groups) {
      await ctx.db.patch(group._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "company_deleted",
      entityType: "company",
      entityId: args.companyId,
      timestamp: now,
    });

    return { success: true };
  },
});

// Reactivate a company
export const reactivateCompany = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const company = await ctx.db.get(args.companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    await ctx.db.patch(args.companyId, {
      isActive: true,
      updatedAt: now,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      action: "company_reactivated",
      entityType: "company",
      entityId: args.companyId,
      timestamp: now,
    });

    return { success: true };
  },
});

// Add a teacher to a company
export const addTeacher = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user with email exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: "teacher",
      companyId: args.companyId,
      isActive: true,
      totalScore: 0,
      averageScore: 0,
      completedTests: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId,
      action: "teacher_added",
      entityType: "user",
      entityId: userId,
      newValues: { name: args.name, email: args.email },
      timestamp: now,
    });

    return userId;
  },
});

// Get company teachers
export const getCompanyTeachers = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const teachers = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .collect();

    // Get groups for each teacher
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    return teachers.map(teacher => ({
      ...teacher,
      groups: groups.filter(g => g.teacherId === teacher._id).map(g => ({
        _id: g._id,
        name: g.name,
        level: g.level,
        studentCount: g.currentStudentCount,
      })),
    }));
  },
});

// Get active companies for dropdown selection (lightweight query)
export const getCompaniesForDropdown = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Return only essential fields for dropdown
    return companies.map(company => ({
      _id: company._id,
      name: company.name,
    }));
  },
});
