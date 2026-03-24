const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaPage<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string };
}

async function fetchMetaPaged<T>(initialUrl: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | undefined = initialUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg =
        (errBody as { error?: { message?: string } }).error?.message ||
        `${response.status} ${response.statusText}`;
      throw new Error(`Meta API error: ${msg}`);
    }

    const page = (await response.json()) as MetaPage<T>;
    if (Array.isArray(page.data)) {
      results.push(...page.data);
    }
    nextUrl = page.paging?.next;
  }

  return results;
}

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
  /** Present when level=ad */
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
}

export async function fetchMetaCampaigns(accessToken: string, adAccountId: string) {
  const effectiveStatuses = JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]);
  const url = `${META_BASE_URL}/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&effective_status=${encodeURIComponent(effectiveStatuses)}&access_token=${accessToken}&limit=500`;
  const rows = await fetchMetaPaged<{
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>(url);

  return rows;
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
  try {
    return await fetchMetaPaged<MetaAdInsight>(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Meta Insights API error: ${message}`);
  }
}

/**
 * Insights agregados no período por anúncio (nomes de campanha/conjunto/anúncio + métricas).
 * Usa time_increment=all_days para uma linha por ad no intervalo.
 */
export async function fetchMetaAdLevelInsights(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetaAdInsight[]> {
  const fields = [
    "campaign_id",
    "campaign_name",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
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

  const url = `${META_BASE_URL}/act_${adAccountId}/insights?fields=${fields}&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=all_days&level=ad&access_token=${accessToken}&limit=500`;
  try {
    return await fetchMetaPaged<MetaAdInsight>(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Meta Ad-level Insights API error: ${message}`);
  }
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
  const toInt = (value: string | undefined) => {
    const n = parseInt(value ?? "", 10);
    return Number.isFinite(n) ? n : 0;
  };
  const toFloat = (value: string | undefined) => {
    const n = parseFloat(value ?? "");
    return Number.isFinite(n) ? n : 0;
  };

  let conversions = 0;
  let revenue = 0;
  let leads = 0;
  let messagingStarted = 0;

  if (insight.actions) {
    for (const action of insight.actions) {
      const type = action.action_type;
      if (type === "offsite_conversion.fb_pixel_lead" || type === "lead") {
        const value = toInt(action.value);
        leads += value;
      }
      // Meta registra conversas do WhatsApp/Messenger nesses action_types.
      if (
        type.includes("messaging_conversation_started") ||
        type.includes("onsite_conversion.messaging_conversation_started")
      ) {
        messagingStarted = Math.max(messagingStarted, toInt(action.value));
      }
    }
  }

  // Usa o maior valor entre action_types de conversa para evitar dupla contagem
  // quando a Meta retorna múltiplas variações do mesmo evento no mesmo dia.
  conversions += messagingStarted;

  if (insight.action_values) {
    for (const actionValue of insight.action_values) {
      if (
        actionValue.action_type === "offsite_conversion.fb_pixel_purchase" ||
        actionValue.action_type === "purchase" ||
        actionValue.action_type === "omni_purchase"
      ) {
        revenue += toFloat(actionValue.value);
      }
    }
  }

  return { conversions, revenue, leads };
}
