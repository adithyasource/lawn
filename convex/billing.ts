import { StripeSubscriptions } from "@convex-dev/stripe";
import { v } from "convex/values";
import Stripe from "stripe";
import { api, components, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { getIdentity, requireTeamAccess } from "./auth";
import {
  getStripePriceIdForPlan,
  getTeamStorageUsedBytes,
  getTeamSubscriptionState,
  hasActiveTeamSubscriptionStatus,
  normalizeStoredTeamPlan,
  resolvePlanFromStripePriceId,
  TEAM_PLAN_MONTHLY_PRICE_USD,
  TEAM_PLAN_STORAGE_LIMIT_BYTES,
  type TeamPlan,
} from "./billingHelpers";

const stripeClient = new StripeSubscriptions(components.stripe, {});
// Only initialize Stripe if API key is present to avoid deployment analysis errors
let stripe: Stripe | null = null;
try {
  if (stripeClient.apiKey) {
    stripe = new Stripe(stripeClient.apiKey);
  }
} catch (e) {
  // Ignore error during analysis if API key is missing
}

const TEAM_TRIAL_DAYS = 7;
const PLAN_RANK = {
  basic: 0,
  pro: 1,
} as const satisfies Record<TeamPlan, number>;

const teamPlanValidator = v.union(v.literal("basic"), v.literal("pro"));
const teamRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
);

export const createSubscriptionCheckout = action({
  args: {
    teamId: v.id("teams"),
    plan: teamPlanValidator,
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{ sessionId: string; url: string | null }> => {
    throw new Error("Billing is disabled for this installation.");
  },
});

export const createCustomerPortalSession = action({
  args: {
    teamId: v.id("teams"),
    returnUrl: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    throw new Error("Billing is disabled for this installation.");
  },
});

export const updateTeamSubscriptionPlan = action({
  args: {
    teamId: v.id("teams"),
    plan: teamPlanValidator,
  },
  returns: v.object({
    plan: teamPlanValidator,
    subscriptionStatus: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ plan: TeamPlan; subscriptionStatus: string }> => {
    throw new Error("Billing is disabled for this installation.");
  },
});

export const getTeamBilling = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    plan: teamPlanValidator,
    monthlyPriceUsd: v.number(),
    storageLimitBytes: v.number(),
    storageUsedBytes: v.number(),
    hasActiveSubscription: v.boolean(),
    subscriptionStatus: v.union(v.string(), v.null()),
    stripeCustomerId: v.union(v.string(), v.null()),
    stripeSubscriptionId: v.union(v.string(), v.null()),
    stripePriceId: v.union(v.string(), v.null()),
    currentPeriodEnd: v.union(v.number(), v.null()),
    role: teamRoleValidator,
    canManageBilling: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireTeamAccess(ctx, args.teamId);
    const subscriptionState = await getTeamSubscriptionState(ctx, args.teamId);
    const storageUsedBytes = await getTeamStorageUsedBytes(ctx, args.teamId);
    const subscription = subscriptionState.subscription;

    return {
      plan: subscriptionState.plan,
      monthlyPriceUsd: TEAM_PLAN_MONTHLY_PRICE_USD[subscriptionState.plan],
      storageLimitBytes: TEAM_PLAN_STORAGE_LIMIT_BYTES[subscriptionState.plan],
      storageUsedBytes,
      hasActiveSubscription: subscriptionState.hasActiveSubscription,
      subscriptionStatus:
        subscription?.status ?? subscriptionState.team.billingStatus ?? null,
      stripeCustomerId:
        subscriptionState.team.stripeCustomerId ??
        subscription?.stripeCustomerId ??
        null,
      stripeSubscriptionId:
        subscription?.stripeSubscriptionId ??
        subscriptionState.team.stripeSubscriptionId ??
        null,
      stripePriceId: subscription?.priceId ?? subscriptionState.team.stripePriceId ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      role: membership.role,
      canManageBilling: membership.role === "owner",
    };
  },
});

export const syncTeamSubscriptionFromWebhook = internalMutation({
  args: {
    orgId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.optional(v.string()),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedOrgId = args.orgId
      ? ctx.db.normalizeId("teams", args.orgId)
      : null;

    let team = normalizedOrgId ? await ctx.db.get(normalizedOrgId) : null;

    if (!team) {
      team = await ctx.db
        .query("teams")
        .withIndex("by_stripe_subscription_id", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
        )
        .unique();
    }

    if (!team && args.stripeCustomerId) {
      team = await ctx.db
        .query("teams")
        .withIndex("by_stripe_customer_id", (q) =>
          q.eq("stripeCustomerId", args.stripeCustomerId),
        )
        .unique();
    }

    if (!team) {
      return null;
    }

    const mappedPlan = resolvePlanFromStripePriceId(args.stripePriceId);
    const normalizedStoredPlan = normalizeStoredTeamPlan(team.plan);

    await ctx.db.patch(team._id, {
      plan: mappedPlan ?? normalizedStoredPlan,
      stripeCustomerId: args.stripeCustomerId ?? team.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId ?? team.stripePriceId,
      billingStatus: args.status,
    });

    return null;
  },
});
