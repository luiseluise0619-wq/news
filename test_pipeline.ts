import { fetchAllActiveSources } from './src/lib/rss/fetcher';
import { fetchPapers } from './src/lib/rss/paperFetcher';
import { clusterArticles } from './src/lib/pipeline/cluster';
import { scoreEvents } from './src/lib/pipeline/score';
import { extractSummaries } from './src/lib/pipeline/extract';
import { buildDailyReport } from './src/lib/report/builder';

async function run() {
  console.log("Mocking AI to avoid API key errors...");

  // Create mock objects
  const mockScore = { score: 8 };
  const mockSummary = {
    what: "테스트 뉴스 사건이 발생했습니다. 여러 언론사에서 이를 보도하고 있습니다.",
    why: "이 사건은 글로벌 경제와 산업계에 큰 영향을 미칠 수 있습니다.",
    future: "관련 당국의 후속 조치와 시장 반응을 지켜봐야 합니다."
  };

  // We can't easily mock the AI provider from here without Jest/Vitest, so we will manually seed the DB with events and bypass the AI for this local DB test.

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  await fetchAllActiveSources();
  await fetchPapers(); // This might fail without API key, but that's okay for UI testing

  // manually create a mock event
  const category = await prisma.category.findFirst();
  const source = await prisma.source.findFirst();

  const article = await prisma.article.create({
    data: {
      title: "Test Article Title",
      url: "http://example.com/test",
      content: "Test content",
      publishedAt: new Date(),
      sourceId: source.id
    }
  });

  const event = await prisma.newsEvent.create({
    data: {
      title: "글로벌 기술 산업의 새로운 변화",
      summaryWhat: mockSummary.what,
      summaryWhy: mockSummary.why,
      summaryFuture: mockSummary.future,
      importanceScore: 8,
      categoryId: category.id,
      articles: { connect: [{ id: article.id }] }
    }
  });

  const paper = await prisma.paper.create({
    data: {
      title: "Attention Is All You Need",
      field: "AI/기계학습",
      authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin",
      publishedAt: new Date(),
      coreFinding: "트랜스포머 아키텍처는 어텐션 메커니즘만을 사용하여 시퀀스 변환 작업을 수행할 수 있음을 증명했습니다.",
      importance: "기존의 RNN/CNN 구조를 대체하며 현재 모든 대형 언어 모델(LLM)의 핵심 기반 기술이 되었습니다.",
      limitations: "명시되지 않음",
      url: "https://arxiv.org/abs/1706.03762",
      importanceScore: 10
    }
  });

  const report = await prisma.dailyReport.create({
    data: {
      date: new Date(),
      topChanges: "- 글로벌 기술 산업의 새로운 변화가 일어났습니다.\n- AI 분야에서 혁신적인 논문이 발표되었습니다.",
      whatMatters: "이러한 변화는 미래 산업 지형을 근본적으로 뒤바꿀 가능성이 높기 때문에 중요합니다.",
      newsEvents: { connect: [{ id: event.id }] },
      papers: { connect: [{ id: paper.id }] }
    }
  });

  console.log("Mock data inserted successfully.");
}

run().catch(console.error);
