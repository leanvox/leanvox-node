import type { HTTPClient } from "../http.js";
import type { AccountBalance, AccountUsage } from "../types.js";

interface RawAccountBalance {
  balance_cents: number;
  total_spent_cents: number;
}

interface RawAccountUsage {
  entries: Record<string, unknown>[];
}

export class AccountResource {
  constructor(private http: HTTPClient) {}

  async balance(): Promise<AccountBalance> {
    const raw = await this.http.request<RawAccountBalance>("GET", "/v1/account/balance");
    return {
      balanceCents: raw.balance_cents,
      totalSpentCents: raw.total_spent_cents,
    };
  }

  async usage(options?: { days?: number; model?: string; limit?: number }): Promise<AccountUsage> {
    const params: Record<string, string | number> = {};
    if (options?.days !== undefined) params["days"] = options.days;
    if (options?.model) params["model"] = options.model;
    if (options?.limit !== undefined) params["limit"] = options.limit;

    const raw = await this.http.request<RawAccountUsage>("GET", "/v1/account/usage", { params });
    return { entries: raw.entries ?? [] };
  }

  async buyCredits(amountCents: number): Promise<Record<string, unknown>> {
    return this.http.request("POST", "/v1/billing/checkout", {
      body: { amount_cents: amountCents },
    });
  }
}
