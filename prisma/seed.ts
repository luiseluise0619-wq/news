import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const categories = [
    '대한민국', '세계', '정치/국제', '경제/금융', '기업/산업',
    'AI', 'IT/테크', '과학', '우주', '의료/바이오',
    '보안/사이버', '국방/안보', '기후/환경', '문화/엔터테인먼트',
    '게임', '스포츠', '독일/유럽', '스타트업', '최신 논문/연구'
  ];

  const dbCategories = [];
  for (const name of categories) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    dbCategories.push(cat);
  }

  const sources = [
    { name: 'BBC News - World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'rss', category: '세계' },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', type: 'rss', category: 'IT/테크' },
    { name: 'MIT Technology Review - AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', type: 'rss', category: 'AI' },
    { name: 'Nature Science Journal', url: 'http://feeds.nature.com/nature/rss/current', type: 'rss', category: '과학' },
    // arXiv ML papers
    { name: 'arXiv Machine Learning', url: 'http://export.arxiv.org/rss/cs.LG', type: 'rss', category: '최신 논문/연구' },
  ];

  for (const source of sources) {
    const category = dbCategories.find(c => c.name === source.category);
    if (category) {
      await prisma.source.create({
        data: {
          name: source.name,
          url: source.url,
          type: source.type,
          categoryId: category.id,
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
