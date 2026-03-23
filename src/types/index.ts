export type UserRole = "ADMIN" | "TEAM" | "CLIENT";

export type PlatformType = "META" | "GOOGLE";

export interface MetricsSummary {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  revenue: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
}

export interface ClientWithMetrics {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  logoUrl: string | null;
  isActive: boolean;
  metrics: MetricsSummary;
  previousMetrics?: MetricsSummary;
  campaignCount: number;
  platforms: PlatformType[];
}

export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  platform: PlatformType;
  accountName: string;
  metrics: MetricsSummary;
  previousMetrics?: MetricsSummary;
  dailyData: DailyMetric[];
}

export interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface FilterState {
  dateRange: DateRange;
  platform: PlatformType | "ALL";
  campaignStatus: string;
}
