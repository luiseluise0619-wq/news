import { PrismaClient } from '@prisma/client'
import { CATEGORY_NAMES, SOURCES } from '../src/lib/data/sources'

const prisma = new PrismaClient()

async function main() {
  const catByName: Record<string, string> = {};
  for (const name of CATEGORY_NAMES) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    catByName[name] = cat.id;
  }

  let added = 0;
  for (const source of SOURCES) {
    const categoryId = catByName[source.category];
    if (!categoryId) continue;

    // url is not the primary key, so upsert-by-url isn't available; guard on it.
    const existing = await prisma.source.findFirst({ where: { url: source.url } });
    if (!existing) {
      await prisma.source.create({
        data: {
          name: source.name,
          url: source.url,
          type: source.type,
          categoryId,
        },
      });
      added++;
    }
  }

  console.log(`Seed complete. Categories: ${CATEGORY_NAMES.length}, new sources added: ${added}.`);
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
