import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Seeding a rich mock report for today...");

  // Clean up existing to avoid unique constraint on date
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  await prisma.dailyReport.deleteMany({
    where: { date: startOfDay }
  });

  const categories = await prisma.category.findMany();

  const getCatId = (name: string) => categories.find(c => c.name === name)?.id;

  const event1 = await prisma.newsEvent.create({
    data: {
      title: "글로벌 금리 인하 발표",
      summaryWhat: "미국 연준이 기준금리를 0.5%p 전격 인하했습니다.",
      summaryWhy: "글로벌 유동성이 증가하며 주식 및 가상자산 시장에 긍정적인 영향을 미칠 것으로 예상됩니다.",
      summaryFuture: "각국 중앙은행들의 연쇄 금리 인하 여부에 주목해야 합니다.",
      importanceScore: 9,
      categoryId: getCatId('경제/금융')
    }
  });

  const event2 = await prisma.newsEvent.create({
    data: {
      title: "오픈AI, 새로운 추론형 AI 모델 공개",
      summaryWhat: "OpenAI가 논리적 추론 능력이 극대화된 새로운 모델을 기습 공개했습니다.",
      summaryWhy: "기존 LLM의 한계였던 복잡한 수학 및 코딩 문제를 스스로 검증하며 풀 수 있게 되었습니다.",
      summaryFuture: "인공지능의 발전 속도가 더욱 가속화되며, 산업 전반의 AI 도입이 빨라질 것입니다.",
      importanceScore: 10,
      categoryId: getCatId('AI')
    }
  });

  const event3 = await prisma.newsEvent.create({
    data: {
      title: "한국형 우주발사체 성공적 궤도 안착",
      summaryWhat: "독자 기술로 개발된 차세대 우주발사체가 성공적으로 발사되어 위성을 궤도에 안착시켰습니다.",
      summaryWhy: "대한민국의 우주 산업 경쟁력이 세계적 수준으로 도약했음을 의미합니다.",
      summaryFuture: "민간 우주 개발 시대(New Space)로의 전환이 본격화될 것입니다.",
      importanceScore: 8,
      categoryId: getCatId('대한민국')
    }
  });

  const paper1 = await prisma.paper.create({
    data: {
      title: "CRISPR-Cas9을 이용한 특정 유전자 치료의 새로운 돌파구",
      field: "생물학/유전공학",
      authors: "Jennifer Doudna et al.",
      publishedAt: new Date(),
      coreFinding: "오프타겟(off-target) 효과를 기존 대비 99% 줄인 새로운 크리스퍼 유전자 가위 기술을 개발했습니다.",
      importance: "유전 질환 치료의 안정성을 극대화하여 실제 임상 적용을 앞당길 수 있습니다.",
      limitations: "장기적인 체내 부작용은 추가 연구가 필요합니다.",
      url: "https://nature.com/example",
      importanceScore: 9
    }
  });

  const report = await prisma.dailyReport.create({
    data: {
      date: startOfDay,
      topChanges: "- 미국 연준, 기준금리 0.5%p 전격 인하\n- OpenAI, 추론 능력 극대화된 신규 AI 모델 공개\n- 한국 독자 기술 우주발사체 발사 성공\n- 크리스퍼 유전자 가위 부작용 99% 감소 기술 개발",
      whatMatters: "오늘은 글로벌 거시경제의 방향성을 결정짓는 금리 인하와, 기술적 특이점을 향해가는 AI 및 우주/바이오 산업의 핵심 발전이 동시에 일어난 매우 중요한 하루입니다. 특히 AI의 추론 능력 향상과 자본 시장의 유동성 공급이 맞물려 테크 산업의 폭발적 성장이 예상됩니다.",
      newsEvents: { connect: [{ id: event1.id }, { id: event2.id }, { id: event3.id }] },
      papers: { connect: [{ id: paper1.id }] }
    }
  });

  console.log("Mock data inserted successfully!");
}

run().catch(console.error);
