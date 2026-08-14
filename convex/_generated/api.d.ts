/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_generateBlocks from "../ai/generateBlocks.js";
import type * as ai_generateQuizAudio from "../ai/generateQuizAudio.js";
import type * as ai_generateQuizQuestions from "../ai/generateQuizQuestions.js";
import type * as ai_lessonDbLogic from "../ai/lessonDbLogic.js";
import type * as ai_openRouterClient from "../ai/openRouterClient.js";
import type * as ai_podcast from "../ai/podcast.js";
import type * as aiContent from "../aiContent.js";
import type * as analytics from "../analytics.js";
import type * as apiIntegrations from "../apiIntegrations.js";
import type * as assessmentActions from "../assessmentActions.js";
import type * as assessmentInvitations from "../assessmentInvitations.js";
import type * as audioContent from "../audioContent.js";
import type * as auth from "../auth.js";
import type * as authLegacy from "../authLegacy.js";
import type * as authUtils from "../authUtils.js";
import type * as companies from "../companies.js";
import type * as companyInvitations from "../companyInvitations.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as debug from "../debug.js";
import type * as emailActions from "../emailActions.js";
import type * as emailCampaigns from "../emailCampaigns.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lessonDb from "../lessonDb.js";
import type * as lessons from "../lessons.js";
import type * as materials from "../materials.js";
import type * as mediaActions from "../mediaActions.js";
import type * as notifications from "../notifications.js";
import type * as progress from "../progress.js";
import type * as quizzes from "../quizzes.js";
import type * as seedAdmin from "../seedAdmin.js";
import type * as settings from "../settings.js";
import type * as testSessions from "../testSessions.js";
import type * as userManagement from "../userManagement.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/generateBlocks": typeof ai_generateBlocks;
  "ai/generateQuizAudio": typeof ai_generateQuizAudio;
  "ai/generateQuizQuestions": typeof ai_generateQuizQuestions;
  "ai/lessonDbLogic": typeof ai_lessonDbLogic;
  "ai/openRouterClient": typeof ai_openRouterClient;
  "ai/podcast": typeof ai_podcast;
  aiContent: typeof aiContent;
  analytics: typeof analytics;
  apiIntegrations: typeof apiIntegrations;
  assessmentActions: typeof assessmentActions;
  assessmentInvitations: typeof assessmentInvitations;
  audioContent: typeof audioContent;
  auth: typeof auth;
  authLegacy: typeof authLegacy;
  authUtils: typeof authUtils;
  companies: typeof companies;
  companyInvitations: typeof companyInvitations;
  crons: typeof crons;
  dashboard: typeof dashboard;
  debug: typeof debug;
  emailActions: typeof emailActions;
  emailCampaigns: typeof emailCampaigns;
  emailTemplates: typeof emailTemplates;
  groups: typeof groups;
  http: typeof http;
  lessonDb: typeof lessonDb;
  lessons: typeof lessons;
  materials: typeof materials;
  mediaActions: typeof mediaActions;
  notifications: typeof notifications;
  progress: typeof progress;
  quizzes: typeof quizzes;
  seedAdmin: typeof seedAdmin;
  settings: typeof settings;
  testSessions: typeof testSessions;
  userManagement: typeof userManagement;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
