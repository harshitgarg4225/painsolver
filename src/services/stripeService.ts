import Stripe from "stripe";

import { env } from "../config/env";

type BillingInterval = "day" | "week" | "month" | "year";

interface ActivePlan {
  unitAmount: number;
  interval: BillingInterval;
  intervalCount: number;
}

const stripeClient = env.USE_MOCK_STRIPE
  ? null
  : new Stripe(env.STRIPE_API_KEY, {
      apiVersion: "2025-02-24.acacia"
    });

function normalizeToMonthly(plan: ActivePlan): number {
  const count = Math.max(plan.intervalCount, 1);

  if (plan.interval === "month") {
    return plan.unitAmount / count;
  }

  if (plan.interval === "year") {
    return plan.unitAmount / (count * 12);
  }

  if (plan.interval === "week") {
    return plan.unitAmount / (count * 4.34524);
  }

  return plan.unitAmount / (count * 30.4375);
}

function mockPlansForEmail(email: string): ActivePlan[] {
  if (email.endsWith("@enterprise.com")) {
    return [
      {
        unitAmount: 1200,
        interval: "year",
        intervalCount: 1
      }
    ];
  }

  if (email.includes("quarter")) {
    return [
      {
        unitAmount: 300,
        interval: "month",
        intervalCount: 3
      }
    ];
  }

  return [
    {
      unitAmount: 99,
      interval: "month",
      intervalCount: 1
    }
  ];
}

async function fetchActivePlans(email: string): Promise<ActivePlan[]> {
  if (!stripeClient) {
    return mockPlansForEmail(email);
  }

  const customers = await stripeClient.customers.list({
    email,
    limit: 1
  });

  const customerId = customers.data[0]?.id;
  if (!customerId) {
    return [];
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 50
  });

  const plans: ActivePlan[] = [];
  for (const subscription of subscriptions.data) {
    for (const item of subscription.items.data) {
      const unitAmountCents = item.price.unit_amount ?? 0;
      const recurring = item.price.recurring;

      if (!recurring || unitAmountCents <= 0) {
        continue;
      }

      plans.push({
        unitAmount: unitAmountCents / 100,
        interval: recurring.interval,
        intervalCount: recurring.interval_count || 1
      });
    }
  }

  return plans;
}

export async function calculateNormalizedMRR(email: string): Promise<number> {
  const plans = await fetchActivePlans(email);
  const monthlyTotal = plans.reduce((sum, plan) => sum + normalizeToMonthly(plan), 0);

  return Number(monthlyTotal.toFixed(2));
}
