import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function main() {
  console.log("Seeding database...");

  await prisma.campaignMetrics.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.note.deleteMany();
  await prisma.adAccount.deleteMany();
  await prisma.clientUser.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash("admin123", 12);
  const teamHash = await bcrypt.hash("team123", 12);
  const clientHash = await bcrypt.hash("cliente123", 12);

  const admin = await prisma.user.create({
    data: { name: "Admin User", email: "admin@dash.com", passwordHash: adminHash, role: "ADMIN" },
  });

  const teamUser = await prisma.user.create({
    data: { name: "Maria Silva", email: "maria@dash.com", passwordHash: teamHash, role: "TEAM" },
  });

  const clientUser = await prisma.user.create({
    data: { name: "João Cliente", email: "cliente@demo.com", passwordHash: clientHash, role: "CLIENT" },
  });

  const clientsData = [
    { name: "TechStore Brasil", slug: "techstore-brasil", industry: "E-commerce" },
    { name: "Fitness Pro Academy", slug: "fitness-pro-academy", industry: "Saúde e Fitness" },
    { name: "Bella Cosméticos", slug: "bella-cosmeticos", industry: "Beleza" },
    { name: "AutoParts Express", slug: "autoparts-express", industry: "Automotivo" },
    { name: "EduTech Learning", slug: "edutech-learning", industry: "Educação" },
    { name: "Sabor & Arte Restaurante", slug: "sabor-arte", industry: "Alimentação" },
    { name: "PetLove Shop", slug: "petlove-shop", industry: "Pet Shop" },
    { name: "Digital Agency Hub", slug: "digital-agency-hub", industry: "Marketing" },
    { name: "ModaFit Clothing", slug: "modafit-clothing", industry: "Moda" },
    { name: "Casa & Decor", slug: "casa-decor", industry: "Decoração" },
    { name: "StartUp Cloud", slug: "startup-cloud", industry: "SaaS" },
    { name: "Viagem Fácil", slug: "viagem-facil", industry: "Turismo" },
    { name: "Green Energy Solutions", slug: "green-energy", industry: "Energia" },
    { name: "Kids Planet", slug: "kids-planet", industry: "Infantil" },
    { name: "Med Clinic Plus", slug: "med-clinic-plus", industry: "Saúde" },
    { name: "Imobiliária Prime", slug: "imobiliaria-prime", industry: "Imobiliário" },
    { name: "Gourmet Delivery", slug: "gourmet-delivery", industry: "Delivery" },
    { name: "Sport Center", slug: "sport-center", industry: "Esportes" },
    { name: "Book World", slug: "book-world", industry: "Livraria" },
    { name: "Farm Fresh", slug: "farm-fresh", industry: "Alimentos Orgânicos" },
    { name: "Tech Gadgets Co", slug: "tech-gadgets", industry: "Tecnologia" },
    { name: "Smart Home Solutions", slug: "smart-home", industry: "Automação" },
  ];

  const clients = [];
  for (const data of clientsData) {
    const client = await prisma.client.create({ data });
    clients.push(client);
  }

  await prisma.clientUser.create({
    data: { userId: clientUser.id, clientId: clients[0].id },
  });

  const campaignTemplates = {
    META: [
      { name: "Campanha de Vendas - Conversão", objective: "OUTCOME_SALES" },
      { name: "Campanha de Leads - Formulário", objective: "OUTCOME_LEADS" },
      { name: "Campanha de Tráfego - Site", objective: "OUTCOME_TRAFFIC" },
      { name: "Remarketing - Carrinho Abandonado", objective: "OUTCOME_SALES" },
      { name: "Lookalike - Compradores", objective: "OUTCOME_SALES" },
    ],
    GOOGLE: [
      { name: "Search - Marca", objective: "SEARCH" },
      { name: "Search - Genérico", objective: "SEARCH" },
      { name: "Shopping - Catálogo", objective: "SHOPPING" },
      { name: "Display - Remarketing", objective: "DISPLAY" },
      { name: "Performance Max", objective: "PERFORMANCE_MAX" },
    ],
  };

  for (const client of clients) {
    const hasMeta = Math.random() > 0.15;
    const hasGoogle = Math.random() > 0.3;

    if (hasMeta) {
      const metaAccount = await prisma.adAccount.create({
        data: {
          clientId: client.id,
          platform: "META",
          accountId: `${1000000 + Math.floor(Math.random() * 9000000)}`,
          accountName: `${client.name} - Meta`,
        },
      });

      const numCampaigns = Math.floor(rand(2, 5));
      const selectedCampaigns = campaignTemplates.META
        .sort(() => Math.random() - 0.5)
        .slice(0, numCampaigns);

      for (const template of selectedCampaigns) {
        const campaign = await prisma.campaign.create({
          data: {
            adAccountId: metaAccount.id,
            platformCampaignId: `meta_${Math.floor(rand(100000, 999999))}`,
            name: template.name,
            status: Math.random() > 0.2 ? "ACTIVE" : "PAUSED",
            objective: template.objective,
            dailyBudget: rand(30, 500),
            startDate: subDays(new Date(), Math.floor(rand(30, 180))),
          },
        });

        const baseDailySpend = rand(30, 400);
        const baseConversionRate = rand(0.01, 0.08);
        const baseRevenuePerConversion = rand(50, 500);

        for (let d = 0; d < 60; d++) {
          const date = subDays(new Date(), d);
          const dayMultiplier = 0.7 + Math.random() * 0.6;
          const spend = baseDailySpend * dayMultiplier;
          const impressions = Math.floor(spend * rand(40, 120));
          const ctr = rand(0.8, 4.5);
          const clicks = Math.floor(impressions * (ctr / 100));
          const conversions = Math.max(0, Math.floor(clicks * baseConversionRate * (0.5 + Math.random())));
          const revenue = conversions * baseRevenuePerConversion * (0.7 + Math.random() * 0.6);
          const reach = Math.floor(impressions * rand(0.6, 0.95));
          const leads = Math.floor(conversions * rand(0.3, 1.2));

          await prisma.campaignMetrics.create({
            data: {
              campaignId: campaign.id,
              date,
              spend,
              impressions,
              reach,
              clicks,
              conversions,
              revenue,
              leads,
              ctr,
              cpc: clicks > 0 ? spend / clicks : 0,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
              cpa: conversions > 0 ? spend / conversions : 0,
              roas: spend > 0 ? revenue / spend : 0,
              frequency: reach > 0 ? impressions / reach : 0,
            },
          });
        }
      }
    }

    if (hasGoogle) {
      const googleAccount = await prisma.adAccount.create({
        data: {
          clientId: client.id,
          platform: "GOOGLE",
          accountId: `${2000000 + Math.floor(Math.random() * 9000000)}`,
          accountName: `${client.name} - Google`,
        },
      });

      const numCampaigns = Math.floor(rand(2, 4));
      const selectedCampaigns = campaignTemplates.GOOGLE
        .sort(() => Math.random() - 0.5)
        .slice(0, numCampaigns);

      for (const template of selectedCampaigns) {
        const campaign = await prisma.campaign.create({
          data: {
            adAccountId: googleAccount.id,
            platformCampaignId: `google_${Math.floor(rand(100000, 999999))}`,
            name: template.name,
            status: Math.random() > 0.2 ? "ACTIVE" : "PAUSED",
            objective: template.objective,
            dailyBudget: rand(20, 400),
            startDate: subDays(new Date(), Math.floor(rand(30, 180))),
          },
        });

        const baseDailySpend = rand(25, 350);
        const baseConversionRate = rand(0.02, 0.1);
        const baseRevenuePerConversion = rand(40, 400);

        for (let d = 0; d < 60; d++) {
          const date = subDays(new Date(), d);
          const dayMultiplier = 0.7 + Math.random() * 0.6;
          const spend = baseDailySpend * dayMultiplier;
          const impressions = Math.floor(spend * rand(30, 100));
          const ctr = rand(1.5, 6.0);
          const clicks = Math.floor(impressions * (ctr / 100));
          const conversions = Math.max(0, Math.floor(clicks * baseConversionRate * (0.5 + Math.random())));
          const revenue = conversions * baseRevenuePerConversion * (0.7 + Math.random() * 0.6);
          const reach = Math.floor(impressions * rand(0.7, 0.95));

          await prisma.campaignMetrics.create({
            data: {
              campaignId: campaign.id,
              date,
              spend,
              impressions,
              reach,
              clicks,
              conversions,
              revenue,
              leads: 0,
              ctr,
              cpc: clicks > 0 ? spend / clicks : 0,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
              cpa: conversions > 0 ? spend / conversions : 0,
              roas: spend > 0 ? revenue / spend : 0,
              frequency: reach > 0 ? impressions / reach : 0,
            },
          });
        }
      }
    }
  }

  await prisma.note.createMany({
    data: [
      { clientId: clients[0].id, userId: admin.id, content: "Aumentar budget da campanha de conversão em 20% na próxima semana." },
      { clientId: clients[0].id, userId: teamUser.id, content: "ROAS está acima da meta. Cliente satisfeito com os resultados." },
      { clientId: clients[1].id, userId: admin.id, content: "Testar novos criativos para a campanha de leads." },
      { clientId: clients[2].id, userId: teamUser.id, content: "Reduzir frequência das campanhas - audiência pode estar saturada." },
    ],
  });

  console.log("Seed completed successfully!");
  console.log(`Created ${clientsData.length} clients with campaigns and metrics.`);
  console.log("Users: admin@dash.com/admin123, maria@dash.com/team123, cliente@demo.com/cliente123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
