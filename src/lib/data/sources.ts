// Single source of truth for news categories and RSS sources.
// Imported by both the Prisma seed script (prisma/seed.ts) and the runtime
// auto-seeding in the collection pipeline, so the two never drift apart.

export const CATEGORY_NAMES = [
  '대한민국', '세계', '정치/국제', '경제/금융', '기업/산업',
  'AI', 'IT/테크', '과학', '우주', '의료/바이오',
  '보안/사이버', '국방/안보', '기후/환경', '문화/엔터테인먼트',
  '게임', '스포츠', '독일/유럽', '스타트업', '최신 논문/연구',
] as const;

export type SourceSeed = {
  name: string;
  url: string;
  type: string;
  category: string;
};

// --- Google News RSS helpers ---------------------------------------------
// Google News feeds are extremely reliable and return Korean-language results,
// which fits this app's purpose. Korean query terms MUST be URL-encoded — Node's
// HTTP client throws ERR_UNESCAPED_CHARACTERS on raw non-ASCII URLs.
const GNEWS = 'https://news.google.com/rss';
const GNEWS_KO = 'hl=ko&gl=KR&ceid=KR:ko';

/** Topic sections: WORLD, NATION, BUSINESS, TECHNOLOGY, ENTERTAINMENT, SPORTS, SCIENCE, HEALTH */
function gnewsTopic(topic: string): string {
  return `${GNEWS}/headlines/section/topic/${topic}?${GNEWS_KO}`;
}

/** Keyword search feed (Korean output). `when:2d` keeps it recent. */
function gnewsSearch(query: string): string {
  return `${GNEWS}/search?q=${encodeURIComponent(query)}&${GNEWS_KO}`;
}

// Reliable, always-fresh backbone so every category has working coverage even
// when a publisher's own feed is down, moved, or geo-blocked.
const BACKBONE_SOURCES: SourceSeed[] = [
  // 대한민국
  { name: '구글뉴스 - 대한민국 헤드라인', url: gnewsTopic('NATION'), type: 'rss', category: '대한민국' },
  { name: '구글뉴스 - 국내 주요뉴스', url: `${GNEWS}?${GNEWS_KO}`, type: 'rss', category: '대한민국' },

  // 세계
  { name: '구글뉴스 - 세계', url: gnewsTopic('WORLD'), type: 'rss', category: '세계' },
  { name: 'The Guardian - World', url: 'https://www.theguardian.com/world/rss', type: 'rss', category: '세계' },

  // 정치/국제
  { name: '구글뉴스 - 국제정치', url: gnewsSearch('국제 정치 when:2d'), type: 'rss', category: '정치/국제' },
  { name: 'The Guardian - US news', url: 'https://www.theguardian.com/us-news/rss', type: 'rss', category: '정치/국제' },

  // 경제/금융
  { name: '구글뉴스 - 경제', url: gnewsTopic('BUSINESS'), type: 'rss', category: '경제/금융' },
  { name: 'The Guardian - Business', url: 'https://www.theguardian.com/business/rss', type: 'rss', category: '경제/금융' },

  // 기업/산업
  { name: '구글뉴스 - 기업/산업', url: gnewsSearch('기업 산업 when:2d'), type: 'rss', category: '기업/산업' },

  // AI
  { name: '구글뉴스 - 인공지능', url: gnewsSearch('인공지능 OR AI when:2d'), type: 'rss', category: 'AI' },
  { name: 'The Guardian - AI', url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss', type: 'rss', category: 'AI' },
  { name: 'VentureBeat - AI', url: 'https://venturebeat.com/category/ai/feed/', type: 'rss', category: 'AI' },

  // IT/테크
  { name: '구글뉴스 - 기술', url: gnewsTopic('TECHNOLOGY'), type: 'rss', category: 'IT/테크' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', type: 'rss', category: 'IT/테크' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', type: 'rss', category: 'IT/테크' },

  // 과학
  { name: '구글뉴스 - 과학', url: gnewsTopic('SCIENCE'), type: 'rss', category: '과학' },
  { name: 'The Guardian - Science', url: 'https://www.theguardian.com/science/rss', type: 'rss', category: '과학' },
  { name: 'Phys.org', url: 'https://phys.org/rss-feed/', type: 'rss', category: '과학' },

  // 우주
  { name: '구글뉴스 - 우주/항공우주', url: gnewsSearch('우주 OR 항공우주 when:2d'), type: 'rss', category: '우주' },
  { name: 'SpaceNews', url: 'https://spacenews.com/feed/', type: 'rss', category: '우주' },

  // 의료/바이오
  { name: '구글뉴스 - 건강/의료', url: gnewsTopic('HEALTH'), type: 'rss', category: '의료/바이오' },
  { name: 'STAT News', url: 'https://www.statnews.com/feed/', type: 'rss', category: '의료/바이오' },

  // 보안/사이버
  { name: '구글뉴스 - 사이버보안', url: gnewsSearch('사이버 보안 OR 해킹 when:2d'), type: 'rss', category: '보안/사이버' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', type: 'rss', category: '보안/사이버' },

  // 국방/안보
  { name: '구글뉴스 - 국방/안보', url: gnewsSearch('국방 OR 안보 when:2d'), type: 'rss', category: '국방/안보' },
  { name: 'Defense One', url: 'https://www.defenseone.com/rss/all/', type: 'rss', category: '국방/안보' },

  // 기후/환경
  { name: '구글뉴스 - 기후/환경', url: gnewsSearch('기후변화 OR 환경 when:2d'), type: 'rss', category: '기후/환경' },
  { name: 'The Guardian - Environment', url: 'https://www.theguardian.com/environment/rss', type: 'rss', category: '기후/환경' },

  // 문화/엔터테인먼트
  { name: '구글뉴스 - 문화/연예', url: gnewsTopic('ENTERTAINMENT'), type: 'rss', category: '문화/엔터테인먼트' },
  { name: 'The Guardian - Culture', url: 'https://www.theguardian.com/culture/rss', type: 'rss', category: '문화/엔터테인먼트' },

  // 게임
  { name: '구글뉴스 - 게임', url: gnewsSearch('게임 when:2d'), type: 'rss', category: '게임' },
  { name: 'The Guardian - Games', url: 'https://www.theguardian.com/games/rss', type: 'rss', category: '게임' },
  { name: 'GameSpot - News', url: 'https://www.gamespot.com/feeds/news/', type: 'rss', category: '게임' },

  // 스포츠
  { name: '구글뉴스 - 스포츠', url: gnewsTopic('SPORTS'), type: 'rss', category: '스포츠' },
  { name: 'The Guardian - Sport', url: 'https://www.theguardian.com/sport/rss', type: 'rss', category: '스포츠' },

  // 독일/유럽
  { name: '구글뉴스 - 유럽', url: gnewsSearch('유럽 OR 독일 when:2d'), type: 'rss', category: '독일/유럽' },
  { name: 'The Guardian - Europe', url: 'https://www.theguardian.com/world/europe-news/rss', type: 'rss', category: '독일/유럽' },
  { name: 'Politico Europe', url: 'https://www.politico.eu/feed/', type: 'rss', category: '독일/유럽' },

  // 스타트업
  { name: '구글뉴스 - 스타트업', url: gnewsSearch('스타트업 when:2d'), type: 'rss', category: '스타트업' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss', category: '스타트업' },

  // 최신 논문/연구
  { name: 'arXiv Computation and Language (cs.CL)', url: 'http://export.arxiv.org/rss/cs.CL', type: 'rss', category: '최신 논문/연구' },
  { name: 'arXiv Computer Vision (cs.CV)', url: 'http://export.arxiv.org/rss/cs.CV', type: 'rss', category: '최신 논문/연구' },
  { name: 'bioRxiv - Recent', url: 'http://connect.biorxiv.org/biorxiv_xml.php?subject=all', type: 'rss', category: '최신 논문/연구' },
];

const PUBLISHER_SOURCES: SourceSeed[] = [
  // 대한민국
  { name: '연합뉴스 - 주요뉴스', url: 'http://www.yonhapnewstv.co.kr/category/news/headline/feed/', type: 'rss', category: '대한민국' },
  { name: 'KBS 뉴스 - 헤드라인', url: 'http://rss.kbs.co.kr/v1/news.xml', type: 'rss', category: '대한민국' },
  { name: '한겨레 - 전체기사', url: 'https://www.hani.co.kr/rss/newsstand/', type: 'rss', category: '대한민국' },

  // 세계
  { name: 'BBC News - World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', type: 'rss', category: '세계' },
  { name: 'NYT - World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', type: 'rss', category: '세계' },
  { name: 'Al Jazeera - Global', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'rss', category: '세계' },

  // 정치/국제
  { name: 'Reuters World (Google News)', url: 'https://news.google.com/rss/search?q=when:24h+reuters+world&hl=en-US&gl=US&ceid=US:en', type: 'rss', category: '정치/국제' },
  { name: 'CNN - Politics', url: 'http://rss.cnn.com/rss/cnn_allpolitics.rss', type: 'rss', category: '정치/국제' },

  // 경제/금융
  { name: 'CNBC - Finance', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', type: 'rss', category: '경제/금융' },
  { name: 'WSJ - Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', type: 'rss', category: '경제/금융' },
  { name: '매일경제 - 경제', url: 'https://www.mk.co.kr/rss/30100041/', type: 'rss', category: '경제/금융' },

  // 기업/산업
  { name: 'Bloomberg - Business', url: 'https://feeds.bloomberg.com/markets/news.rss', type: 'rss', category: '기업/산업' },
  { name: 'Business Insider', url: 'http://feeds.businessinsider.com/custom/all', type: 'rss', category: '기업/산업' },

  // AI
  { name: 'MIT Technology Review - AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', type: 'rss', category: 'AI' },
  { name: 'Google AI Blog', url: 'http://ai.googleblog.com/feeds/posts/default?alt=rss', type: 'rss', category: 'AI' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', type: 'rss', category: 'AI' },

  // IT/테크
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', type: 'rss', category: 'IT/테크' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', type: 'rss', category: 'IT/테크' },
  { name: 'Wired - Top Stories', url: 'https://www.wired.com/feed/rss', type: 'rss', category: 'IT/테크' },
  { name: 'Bloter', url: 'http://www.bloter.net/?format=feed&type=rss', type: 'rss', category: 'IT/테크' },

  // 과학
  { name: 'Nature Science Journal', url: 'http://feeds.nature.com/nature/rss/current', type: 'rss', category: '과학' },
  { name: 'Science Daily - Top News', url: 'https://www.sciencedaily.com/rss/top_news.xml', type: 'rss', category: '과학' },
  { name: 'Scientific American', url: 'http://rss.sciam.com/ScientificAmerican-Global', type: 'rss', category: '과학' },

  // 우주
  { name: 'NASA Breaking News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', type: 'rss', category: '우주' },
  { name: 'Space.com', url: 'https://www.space.com/feeds/all', type: 'rss', category: '우주' },

  // 의료/바이오
  { name: 'Medical Xpress', url: 'https://medicalxpress.com/rss-feed/', type: 'rss', category: '의료/바이오' },
  { name: 'NIH News Releases', url: 'https://www.nih.gov/news-events/news-releases/rss.xml', type: 'rss', category: '의료/바이오' },

  // 보안/사이버
  { name: 'The Hacker News - Security', url: 'https://feeds.feedburner.com/TheHackersNews', type: 'rss', category: '보안/사이버' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', type: 'rss', category: '보안/사이버' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', type: 'rss', category: '보안/사이버' },

  // 국방/안보
  { name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', type: 'rss', category: '국방/안보' },

  // 기후/환경
  { name: 'Yale Environment 360', url: 'https://e360.yale.edu/feed', type: 'rss', category: '기후/환경' },
  { name: 'EarthSky', url: 'https://earthsky.org/feed/', type: 'rss', category: '기후/환경' },

  // 문화/엔터테인먼트
  { name: 'Variety', url: 'https://variety.com/feed/', type: 'rss', category: '문화/엔터테인먼트' },
  { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', type: 'rss', category: '문화/엔터테인먼트' },
  { name: '텐아시아', url: 'https://tenasia.hankyung.com/feed/rss', type: 'rss', category: '문화/엔터테인먼트' },

  // 게임
  { name: 'IGN - Games', url: 'http://feeds.ign.com/ign/games-all', type: 'rss', category: '게임' },
  { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', type: 'rss', category: '게임' },
  { name: '인벤 (Inven) 주요기사', url: 'http://web.inven.co.kr/api/inven_main_news_rss.php', type: 'rss', category: '게임' },

  // 스포츠
  { name: 'ESPN Top News', url: 'https://www.espn.com/espn/rss/news', type: 'rss', category: '스포츠' },
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', type: 'rss', category: '스포츠' },
  { name: 'OSEN 스포츠', url: 'https://osen.co.kr/feed/sports', type: 'rss', category: '스포츠' },

  // 독일/유럽
  { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', type: 'rss', category: '독일/유럽' },
  { name: 'France 24 - Europe', url: 'https://www.france24.com/en/europe/rss', type: 'rss', category: '독일/유럽' },

  // 스타트업
  { name: 'TechCrunch - Startups', url: 'https://techcrunch.com/category/startups/feed/', type: 'rss', category: '스타트업' },
  { name: '벤처스퀘어', url: 'https://www.venturesquare.net/feed', type: 'rss', category: '스타트업' },
  { name: 'Platum', url: 'https://platum.kr/feed', type: 'rss', category: '스타트업' },

  // 최신 논문/연구 (Papers)
  { name: 'arXiv Machine Learning (cs.LG)', url: 'http://export.arxiv.org/rss/cs.LG', type: 'rss', category: '최신 논문/연구' },
  { name: 'arXiv AI (cs.AI)', url: 'http://export.arxiv.org/rss/cs.AI', type: 'rss', category: '최신 논문/연구' },
  { name: 'arXiv Quantitative Biology (q-bio)', url: 'http://export.arxiv.org/rss/q-bio', type: 'rss', category: '최신 논문/연구' },
  { name: 'Nature Communications', url: 'http://feeds.nature.com/ncomms/rss/current', type: 'rss', category: '최신 논문/연구' },
];

// Reliable backbone first so rotation surfaces working feeds early, then the
// broader publisher list. De-duplicated by URL.
export const SOURCES: SourceSeed[] = (() => {
  const combined = [...BACKBONE_SOURCES, ...PUBLISHER_SOURCES];
  const seen = new Set<string>();
  return combined.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
})();
