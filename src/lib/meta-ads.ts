const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaAdInsight {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  ctr: string;
  cpc: string;
  cpm: string;
  frequency: string;
  campaign_id: string;
  campaign_name: string;
}

export async function fetchMetaCampaigns(accessToken: string, adAccountId: string) {
  const effectiveStatuses = JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]);
  const url = `${META_BASE_URL}/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&effective_status=${encodeURIComponent(effectiveStatuses)}&access_token=${accessToken}&limit=500`;

  const response = await fetch(url);
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Meta API error: ${msg}`);
  }

  const data = await response.json();
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows as {
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }[];
}

export async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaAdInsight[]> {
  const fields = [
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "actions",
    "action_values",
    "ctr",
    "cpc",
    "cpm",
    "frequency",
  ].join(",");

  const url = `${META_BASE_URL}/act_${adAccountId}/insights?fields=${fields}&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=1&level=campaign&access_token=${accessToken}&limit=500`;

  const response = await fetch(url);
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message || String(response.status);
    throw new Error(`Meta Insights API error: ${msg}`);
  }

  const data = await response.json();
  return (Array.isArray(data.data) ? data.data : []) as MetaAdInsight[];
}

export function parseMetaStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    DELETED: "REMOVED",
    ARCHIVED: "ARCHIVED",
  };
  return map[status] || "PAUSED";
}

export function extractConversions(insight: MetaAdInsight): { conversions: number; revenue: number; leads: number } {
  let conversions = 0;
  let revenue = 0;
  let leads = 0;

  if (insight.actions) {
    for (const action of insight.actions) {
      if (action.action_type === "offsite_conversion.fb_pixel_purchase") {
        conversions += parseInt(action.value, 10);
      }
      if (action.action_type === "offsite_conversion.fb_pixel_lead" || action.action_type === "lead") {
        leads += parseInt(action.value, 10);
      }
      if (action.action_type === "purchase" || action.action_type === "omni_purchase") {
        conversions += parseInt(action.value, 10);
      }
    }
  }

  if (insight.action_values) {
    for (const actionValue of insight.action_values) {
      if (
        actionValue.action_type === "offsite_conversion.fb_pixel_purchase" ||
        actionValue.action_type === "purchase" ||
        actionValue.action_type === "omni_purchase"
      ) {
        revenue += parseFloat(actionValue.value);
      }
    }
  }

  return { conversions, revenue, leads };
}
