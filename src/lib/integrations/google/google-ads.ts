const GOOGLE_ADS_API_VERSION = "v17";
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export interface GoogleAdsCampaign {
  campaign: {
    resourceName: string;
    id: string;
    name: string;
    status: string;
    campaignBudget: string;
    startDate: string;
    endDate?: string;
  };
}

export interface GoogleAdsMetric {
  campaign: { id: string; name: string };
  segments: { date: string };
  metrics: {
    costMicros: string;
    impressions: string;
    clicks: string;
    conversions: number;
    conversionsValue: number;
    ctr: number;
    averageCpc: string;
    averageCpm: string;
  };
}

export async function fetchGoogleCampaigns(
  accessToken: string,
  customerId: string,
  developerToken: string
): Promise<GoogleAdsCampaign[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.campaign_budget,
      campaign.start_date,
      campaign.end_date
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;

  const response = await fetch(
    `${GOOGLE_ADS_BASE_URL}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google Ads API error: ${response.status}`);
  }

  const data = await response.json();
  return (data[0]?.results || []) as GoogleAdsCampaign[];
}

export async function fetchGoogleMetrics(
  accessToken: string,
  customerId: string,
  developerToken: string,
  dateFrom: string,
  dateTo: string
): Promise<GoogleAdsMetric[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
    ORDER BY segments.date
  `;

  const response = await fetch(
    `${GOOGLE_ADS_BASE_URL}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google Ads Metrics API error: ${response.status}`);
  }

  const data = await response.json();
  return (data[0]?.results || []) as GoogleAdsMetric[];
}

export function parseGoogleStatus(status: string): string {
  const map: Record<string, string> = {
    ENABLED: "ACTIVE",
    PAUSED: "PAUSED",
    REMOVED: "REMOVED",
  };
  return map[status] || "PAUSED";
}

export function microsToDecimal(micros: string): number {
  return parseInt(micros, 10) / 1_000_000;
}
