// Auth utility functions for Convex
import { v } from "convex/values";

// Require a user to be authenticated
export const requireUser = async (ctx: any, userId: string) => {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

// Require a company to be valid
export const requireCompany = async (ctx: any, companyId: string) => {
  const company = await ctx.db.get(companyId);
  if (!company) {
    throw new Error("Company not found");
  }
  return company;
};

// Validate user permissions
export const requirePermission = (user: any, requiredRole: string) => {
  const roleHierarchy = ['student', 'teacher', 'admin', 'corporate_admin'];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  if (userRoleIndex < 0 || requiredRoleIndex < 0) {
    throw new Error("Invalid role");
  }

  if (userRoleIndex < requiredRoleIndex) {
    throw new Error("Insufficient permissions");
  }
};

// Check if user belongs to company
export const requireCompanyAccess = (user: any, companyId: string) => {
  if (user.companyId !== companyId) {
    throw new Error("Access denied to this company");
  }
};