import type { PrismaClient } from "@prisma/client"
import type { SeedUsers } from "./users"
import { SEED_IMAGES } from "./constants"
import { daysFromNow, syncCourseSections } from "./helpers"

const STARTER_OUTCOMES = [
  "Understand how the Forex market works",
  "Learn currency pairs, pips, and lot sizes",
  "Read charts and apply basic technical analysis",
  "Master risk management and trading psychology",
  "Earn a certificate upon 100% completion",
]

const ENGLISH_MASTERCLASS_OUTCOMES = [
  "Understand how the Forex market works",
  "Read charts and apply basic technical analysis",
  "Manage risk with proper position sizing",
  "Build disciplined trading psychology",
  "Earn a certificate upon 100% completion",
]

const INSTITUTIONAL_OUTCOMES = [
  "Understand institutional market structure and liquidity concepts",
  "Apply SMC and ICT techniques on live charts",
  "Identify order blocks, fair value gaps, and liquidity sweeps",
  "Build a professional risk management framework",
  "Earn a certificate upon 100% completion",
]

const BEGINNER_TRADING_WEALTH_OUTCOMES = [
  "Understand day trading vs investing and when to use each approach",
  "Set up a broker, charting platform, and basic risk plan",
  "Follow a structured 2026 beginner trading roadmap",
  "Apply wealth-building habits and disciplined mindset early",
  "Earn a certificate upon 100% completion",
]

const DEFAULT_COURSE_FAQS = [
  {
    question: "How long will I have access to this course?",
    answer:
      "Once you enroll, you get lifetime access to the course content, including future updates at no extra cost.",
  },
  {
    question: "Do I need prior experience to take this course?",
    answer:
      "No. The course is designed from the fundamentals upward, so beginners can follow along step by step.",
  },
  {
    question: "Will I get a certificate upon completion?",
    answer:
      "Yes. After completing all lessons you receive a verifiable certificate you can add to your CV or LinkedIn profile.",
  },
  {
    question: "Is live support included?",
    answer:
      "Live support availability depends on the course format. Check the schedule and delivery details on this page.",
  },
]

const LIVE_COURSE_MARKETING = {
  badgeLabel: "Live Course",
  deliveryType: "Live Online",
  classSchedule: "9:00 PM - 10:30 PM",
  refundDays: 7,
  highlights: [
    "Lifetime access",
    "Live support sessions",
    "Certificate of completion",
    "Practical trading projects",
  ],
  faqs: DEFAULT_COURSE_FAQS,
}

const YOUTUBE_THUMB = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`

type SeedVideoLesson = {
  title: string
  type: "VIDEO"
  duration: number
  order: number
  isFree?: boolean
  youtubeId?: string
}

type SeedTextLesson = {
  title: string
  type: "TEXT"
  duration: number
  order: number
  isFree?: boolean
  content: string
}

type SeedQuizLesson = {
  title: string
  type: "QUIZ"
  duration: number
  order: number
  isFree?: boolean
  content: string
}

type SeedLesson = SeedVideoLesson | SeedTextLesson | SeedQuizLesson

function mapSeedLesson(lesson: SeedLesson) {
  if (lesson.type === "VIDEO" && "youtubeId" in lesson && lesson.youtubeId) {
    const { youtubeId, ...rest } = lesson
    return {
      ...rest,
      videoProvider: "YOUTUBE" as const,
      videoRef: youtubeId,
    }
  }

  return lesson
}

export async function seedContent(prisma: PrismaClient, users: SeedUsers) {
  const instructorId = users.instructorUser.instructor!.id

  const courses = [
    {
      title: "Institutional Forex Mastery: Live Trading Strategies, SMC & ICT Techniques",
      slug: "institutional-forex-mastery",
      description:
        "Master institutional trading strategies with SMC and ICT techniques. Learn live trading setups, liquidity concepts, and professional risk management.",
      thumbnailUrl: SEED_IMAGES.courseAdvanced,
      price: 300,
      originalPrice: 500,
      level: "ADVANCED" as const,
      language: "ENGLISH",
      isFeatured: true,
      totalDuration: 72000,
      learningOutcomes: INSTITUTIONAL_OUTCOMES,
      subtitle:
        "Learn institutional forex trading from scratch, master advanced market structures, and build your own trading systems.",
      discountEndsAt: daysFromNow(5),
      startsAt: daysFromNow(14),
      seatLimit: 50,
      ...LIVE_COURSE_MARKETING,
      sections: [
        {
          title: "Market Structure Fundamentals",
          order: 1,
          lessons: [
            { title: "Introduction to Institutional Trading", type: "VIDEO" as const, duration: 1200, order: 1, isFree: true, youtubeId: "dQw4w9WgXcQ" },
            { title: "Understanding Market Structure", type: "VIDEO" as const, duration: 1800, order: 2, youtubeId: "dQw4w9WgXcQ" },
            { title: "Break of Structure (BOS)", type: "VIDEO" as const, duration: 1500, order: 3, youtubeId: "dQw4w9WgXcQ" },
          ],
        },
        {
          title: "SMC & ICT Concepts",
          order: 2,
          lessons: [
            { title: "Smart Money Concepts Overview", type: "VIDEO" as const, duration: 2100, order: 1, youtubeId: "dQw4w9WgXcQ" },
            { title: "Fair Value Gaps (FVG)", type: "VIDEO" as const, duration: 1800, order: 2, youtubeId: "dQw4w9WgXcQ" },
            { title: "Order Blocks & Liquidity Sweeps", type: "VIDEO" as const, duration: 2400, order: 3, youtubeId: "dQw4w9WgXcQ" },
          ],
        },
      ],
    },
    {
      title: "Forex Trading Masterclass (Beginner to Advanced)",
      slug: "forex-trading-masterclass",
      description:
        "Complete Forex trading course from beginner to advanced. Learn market basics, technical analysis, trading psychology, and live trading sessions.",
      thumbnailUrl: SEED_IMAGES.courseBeginner,
      price: 30,
      originalPrice: 50,
      level: "BEGINNER" as const,
      language: "ENGLISH",
      isFeatured: true,
      totalDuration: 36000,
      learningOutcomes: ENGLISH_MASTERCLASS_OUTCOMES,
      subtitle:
        "A complete forex trading path from market basics to live-ready technical analysis and risk management.",
      badgeLabel: "Self-paced",
      deliveryType: "Recorded + Live Q&A",
      refundDays: 7,
      highlights: [
        "Lifetime access",
        "Beginner-friendly lessons",
        "Certificate of completion",
        "Downloadable resources",
      ],
      faqs: DEFAULT_COURSE_FAQS,
      sections: [
        {
          title: "Forex Market Basics",
          order: 1,
          lessons: [
            { title: "What is Forex Trading?", type: "VIDEO" as const, duration: 900, order: 1, isFree: true, youtubeId: "dQw4w9WgXcQ" },
            { title: "Currency Pairs Explained", type: "VIDEO" as const, duration: 1200, order: 2, youtubeId: "dQw4w9WgXcQ" },
            { title: "How to Choose a Broker", type: "VIDEO" as const, duration: 1500, order: 3, youtubeId: "dQw4w9WgXcQ" },
          ],
        },
        {
          title: "Technical Analysis",
          order: 2,
          lessons: [
            { title: "Reading Candlestick Charts", type: "VIDEO" as const, duration: 1800, order: 1, youtubeId: "dQw4w9WgXcQ" },
            { title: "Support & Resistance", type: "VIDEO" as const, duration: 1500, order: 2, youtubeId: "dQw4w9WgXcQ" },
            { title: "Trend Analysis", type: "VIDEO" as const, duration: 1200, order: 3, youtubeId: "dQw4w9WgXcQ" },
          ],
        },
      ],
    },
    {
      title: "Forex Starter Course — Basic to Intermediate",
      slug: "forex-course-bangla",
      description:
        "Learn Forex trading from the ground up. Follow video lectures, text guides, and quizzes from basic to intermediate level. Earn a certificate upon 100% completion.",
      thumbnailUrl: SEED_IMAGES.courseBangla,
      price: 0,
      originalPrice: 50,
      level: "BEGINNER" as const,
      language: "ENGLISH",
      isFeatured: true,
      totalDuration: 5400,
      learningOutcomes: STARTER_OUTCOMES,
      sections: [
        {
          title: "Forex Basics",
          order: 1,
          lessons: [
            { title: "What is the Forex Market?", type: "VIDEO" as const, duration: 900, order: 1, isFree: true, youtubeId: "dQw4w9WgXcQ" },
            { title: "Understanding Currency Pairs", type: "VIDEO" as const, duration: 1200, order: 2, isFree: true, youtubeId: "dQw4w9WgXcQ" },
            {
              title: "Forex Basics — Text Guide",
              type: "TEXT" as const,
              duration: 600,
              order: 3,
              isFree: false,
              content:
                "<h2>Introduction to the Forex Market</h2><p>Forex (Foreign Exchange) is the world's largest financial market, with trillions of dollars traded every day.</p><h3>Key Concepts</h3><ul><li><strong>Base currency</strong> — the first currency in a pair</li><li><strong>Quote currency</strong> — the second currency in a pair</li><li><strong>Pip</strong> — the smallest price movement unit</li><li><strong>Lot</strong> — the size of a trade</li></ul>",
            },
          ],
        },
        {
          title: "Charts & Technical Analysis",
          order: 2,
          lessons: [
            { title: "Reading Candlestick Charts", type: "VIDEO" as const, duration: 1500, order: 1, isFree: false, youtubeId: "dQw4w9WgXcQ" },
            {
              title: "Support & Resistance — Text Guide",
              type: "TEXT" as const,
              duration: 600,
              order: 2,
              isFree: false,
              content:
                "<h2>Support and Resistance</h2><p>Support is the price level where buying pressure increases. Resistance is where selling pressure builds.</p><p>Identify these levels to plan trade entries and set stop losses.</p>",
            },
          ],
        },
        {
          title: "Risk Management",
          order: 3,
          lessons: [
            {
              title: "Risk Management Quiz",
              type: "QUIZ" as const,
              duration: 300,
              order: 1,
              isFree: false,
              content: JSON.stringify({
                passScore: 70,
                maxAttempts: 3,
                questions: [
                  {
                    id: "q1",
                    text: "What percentage of your account should you risk per trade?",
                    options: ["1%", "10%", "50%", "100%"],
                    correctIndex: 0,
                  },
                  {
                    id: "q2",
                    text: "Why do traders use a stop loss?",
                    options: [
                      "To increase profits",
                      "To limit losses",
                      "To please the broker",
                      "To make the chart look better",
                    ],
                    correctIndex: 1,
                  },
                ],
              }),
            },
          ],
        },
      ],
    },
    {
      title: "Complete Beginner Trading & Wealth Foundation",
      slug: "beginner-trading-wealth-foundation",
      description:
        "Free curated path for new traders: day trading fundamentals, a 2026 beginner roadmap, wealth mindset principles, study guides, and a knowledge check.",
      thumbnailUrl: YOUTUBE_THUMB("xHU5MHuUSKI"),
      price: 0,
      originalPrice: 29,
      level: "BEGINNER" as const,
      language: "ENGLISH",
      isFeatured: true,
      totalDuration: 15900,
      learningOutcomes: BEGINNER_TRADING_WEALTH_OUTCOMES,
      sections: [
        {
          title: "Welcome",
          order: 1,
          lessons: [
            {
              title: "Course Overview — Getting Started with Trading",
              type: "VIDEO" as const,
              duration: 1800,
              order: 1,
              isFree: true,
              youtubeId: "iBMfg4WkKL8",
            },
            {
              title: "What You'll Learn in This Path",
              type: "TEXT" as const,
              duration: 600,
              order: 2,
              isFree: true,
              content:
                "<h2>Your Learning Path</h2><p>This free course bundles four expert video lessons into a structured journey — not just a playlist.</p><h3>Modules</h3><ol><li><strong>Day Trading Basics</strong> — markets, setups, and risk for beginners</li><li><strong>2026 Trading Roadmap</strong> — step-by-step plan to start trading this year</li><li><strong>Wealth Mindset</strong> — habits that compound long before your first profit</li><li><strong>Knowledge Check</strong> — quiz to confirm you understood the essentials</li></ol><p>Watch each video, read the summary notes, then take the final quiz. Complete 100% to earn your certificate.</p>",
            },
          ],
        },
        {
          title: "Day Trading Foundations",
          order: 2,
          lessons: [
            {
              title: "How To Start Day Trading As A Beginner In 2025",
              type: "VIDEO" as const,
              duration: 3600,
              order: 1,
              isFree: true,
              youtubeId: "xHU5MHuUSKI",
            },
            {
              title: "Summary — Day Trading Key Points",
              type: "TEXT" as const,
              duration: 600,
              order: 2,
              isFree: true,
              content:
                "<h2>Day Trading — Key Points</h2><ul><li><strong>Day trading</strong> means opening and closing trades within the same day — less overnight risk</li><li>Requires more focus, faster decisions, and strict risk management than investing</li><li>Start with a broker, charting platform, and demo account</li><li>Do not risk more than 1–2% of your account per trade</li><li>Pick one strategy and practice it repeatedly — keep a journal</li></ul>",
            },
          ],
        },
        {
          title: "Trading in 2026",
          order: 3,
          lessons: [
            {
              title: "HOW to Start Trading in 2026 (Complete Beginner's Guide)",
              type: "VIDEO" as const,
              duration: 3600,
              order: 1,
              isFree: true,
              youtubeId: "4CQzOXbkLqY",
            },
            {
              title: "Your 2026 Trading Checklist",
              type: "TEXT" as const,
              duration: 600,
              order: 2,
              isFree: true,
              content:
                "<h2>2026 Trading Checklist</h2><ul><li>✅ Choose a licensed broker (check spreads, regulation, and demo account)</li><li>✅ Write a trading plan — which market, which session, how much risk</li><li>✅ Complete at least 30 demo trades before using real money</li><li>✅ Set stop loss and take profit rules in advance</li><li>✅ Journal at the end of each day — what worked and what did not</li><li>✅ Start live with small capital after consistent demo results</li></ul>",
            },
          ],
        },
        {
          title: "Wealth Mindset",
          order: 4,
          lessons: [
            {
              title: "7 Principles For Teenagers To Become Millionaires",
              type: "VIDEO" as const,
              duration: 1800,
              order: 1,
              isFree: true,
              youtubeId: "1-izXBhkiHw",
            },
            {
              title: "Notes — Millionaire Mindset Principles",
              type: "TEXT" as const,
              duration: 600,
              order: 2,
              isFree: true,
              content:
                "<h2>Millionaire Mindset — 7 Principles</h2><ol><li><strong>Keep learning</strong> — skill investment delivers the best returns</li><li><strong>Control spending</strong> — cut waste before chasing higher income</li><li><strong>Think long term</strong> — avoid get-rich-quick traps</li><li><strong>Build income streams</strong> — do not rely on a single source</li><li><strong>Grow your network</strong> — surround yourself with the right people</li><li><strong>Build habits</strong> — small daily actions compound into big results</li><li><strong>Take action</strong> — knowledge only matters when you apply it</li></ol>",
            },
          ],
        },
        {
          title: "Knowledge Check",
          order: 5,
          lessons: [
            {
              title: "Beginner Trading Knowledge Check",
              type: "QUIZ" as const,
              duration: 300,
              order: 1,
              isFree: true,
              content: JSON.stringify({
                passScore: 70,
                maxAttempts: 3,
                questions: [
                  {
                    id: "q1",
                    text: "What is the main difference between day trading and long-term investing?",
                    options: [
                      "Day trading holds positions overnight",
                      "Day trading opens and closes positions within the same day",
                      "Investing requires more leverage",
                      "There is no difference",
                    ],
                    correctIndex: 1,
                  },
                  {
                    id: "q2",
                    text: "What is a safe risk amount per trade for most beginners?",
                    options: ["10–20% of account", "1–2% of account", "50% of account", "Whatever feels right"],
                    correctIndex: 1,
                  },
                  {
                    id: "q3",
                    text: "What should you do before trading with real money?",
                    options: [
                      "Skip practice and go live immediately",
                      "Practice on demo and follow a written trading plan",
                      "Copy random signals from social media",
                      "Trade only during news without a stop loss",
                    ],
                    correctIndex: 1,
                  },
                  {
                    id: "q4",
                    text: "Why is a trading journal important?",
                    options: [
                      "To impress other traders",
                      "To track what works, spot mistakes, and improve discipline",
                      "Brokers require it by law",
                      "It guarantees profits",
                    ],
                    correctIndex: 1,
                  },
                  {
                    id: "q5",
                    text: "Which habit best supports long-term wealth building?",
                    options: [
                      "Chasing every hot tip",
                      "Consistent learning, controlled spending, and taking action",
                      "Avoiding all financial education",
                      "Trading with maximum leverage daily",
                    ],
                    correctIndex: 1,
                  },
                ],
              }),
            },
          ],
        },
      ],
    },
  ]

  for (const courseData of courses) {
    const { sections, ...courseFields } = courseData
    const existing = await prisma.course.findUnique({ where: { slug: courseFields.slug } })
    if (!existing) {
      await prisma.course.create({
        data: {
          ...courseFields,
          instructorId,
          status: "PUBLISHED",
          publishedAt: new Date(),
          sections: {
            create: sections.map((section) => ({
              title: section.title,
              order: section.order,
              lessons: {
                create: section.lessons.map((lesson) => mapSeedLesson(lesson as SeedLesson)),
              },
            })),
          },
        },
      })
    } else {
      await prisma.course.update({
        where: { slug: courseFields.slug },
        data: {
          title: courseFields.title,
          description: courseFields.description,
          totalDuration: courseFields.totalDuration,
          originalPrice: courseFields.originalPrice,
          learningOutcomes: courseFields.learningOutcomes,
          thumbnailUrl: courseFields.thumbnailUrl,
          level: courseFields.level,
          language: courseFields.language,
          isFeatured: courseFields.isFeatured,
          subtitle: "subtitle" in courseFields ? courseFields.subtitle : undefined,
          badgeLabel: "badgeLabel" in courseFields ? courseFields.badgeLabel : undefined,
          highlights: "highlights" in courseFields ? courseFields.highlights : undefined,
          faqs: "faqs" in courseFields ? courseFields.faqs : undefined,
          discountEndsAt: "discountEndsAt" in courseFields ? courseFields.discountEndsAt : undefined,
          seatLimit: "seatLimit" in courseFields ? courseFields.seatLimit : undefined,
          startsAt: "startsAt" in courseFields ? courseFields.startsAt : undefined,
          classSchedule: "classSchedule" in courseFields ? courseFields.classSchedule : undefined,
          deliveryType: "deliveryType" in courseFields ? courseFields.deliveryType : undefined,
          refundDays: "refundDays" in courseFields ? courseFields.refundDays : undefined,
        },
      })

      await syncCourseSections(
        prisma,
        existing.id,
        sections.map((section) => ({
          title: section.title,
          order: section.order,
          lessons: section.lessons.map((lesson) => mapSeedLesson(lesson as SeedLesson)),
        }))
      )
    }
  }

  await prisma.certIdCounter.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", count: 0 },
  })

  await prisma.orderIdCounter.upsert({
    where: { id: "global" },
    update: { count: 1 },
    create: { id: "global", count: 1 },
  })

  const marketCategory = await prisma.blogCategory.upsert({
    where: { slug: "market-analysis" },
    update: {},
    create: { name: "Market Analysis", slug: "market-analysis" },
  })

  const forexNewsCategory = await prisma.blogCategory.upsert({
    where: { slug: "forex-news" },
    update: {},
    create: { name: "Forex News", slug: "forex-news" },
  })

  const psychologyCategory = await prisma.blogCategory.upsert({
    where: { slug: "trading-psychology" },
    update: {},
    create: { name: "Trading Psychology", slug: "trading-psychology" },
  })

  const ictCategory = await prisma.blogCategory.upsert({
    where: { slug: "ict-concepts" },
    update: {},
    create: { name: "ICT Concepts", slug: "ict-concepts" },
  })

  const blogPosts = [
    {
      title: "EUR/USD Weekly Outlook: Key Levels to Watch",
      slug: "eur-usd-weekly-outlook",
      excerpt: "Technical analysis of EUR/USD with support and resistance zones for the coming week.",
      content:
        "## EUR/USD Analysis\n\nThis week we focus on the 1.0850 support zone and 1.0950 resistance. Institutional order blocks suggest a potential reversal at key liquidity pools.\n\n### Key Takeaways\n- Watch for BOS above 1.0920\n- Risk management: 1% per trade\n- Session focus: London open",
      coverUrl: SEED_IMAGES.blogCover1,
      categoryId: marketCategory.id,
      authorId: users.adminUser.id,
      isPremium: false,
    },
    {
      title: "ICT Concepts: Understanding Fair Value Gaps",
      slug: "ict-fair-value-gaps",
      excerpt: "Learn how institutional traders use Fair Value Gaps (FVG) for high-probability entries.",
      content:
        "## What is a Fair Value Gap?\n\nA Fair Value Gap occurs when price moves aggressively, leaving an imbalance between candles. These gaps often act as magnets for price.\n\n### How to Trade FVGs\n1. Identify the gap on H1/H4 timeframe\n2. Wait for price to return to the gap\n3. Look for confirmation (BOS, CHoCH)\n4. Enter with tight stop loss",
      coverUrl: SEED_IMAGES.blogCover2,
      categoryId: ictCategory.id,
      authorId: users.adminUser.id,
      isPremium: true,
    },
    {
      title: "Gold (XAUUSD) Trading Strategy for Beginners",
      slug: "gold-trading-strategy-beginners",
      excerpt: "A simple yet effective gold trading approach using supply and demand zones.",
      content:
        "## Gold Trading Basics\n\nXAUUSD is one of the most traded instruments. Its correlation with USD strength makes it ideal for forex traders.\n\n### Strategy Steps\n- Mark daily supply/demand zones\n- Trade during NY session overlap\n- Use 15-min entry timeframe",
      coverUrl: SEED_IMAGES.blogCover3,
      categoryId: marketCategory.id,
      authorId: users.adminUser.id,
      isPremium: false,
    },
    {
      title: "XAUUSD Weekly Analysis: Key Supply & Demand Zones",
      slug: "xauusd-weekly-analysis",
      excerpt: "Weekly gold outlook with institutional levels, liquidity pools, and session-based entries.",
      content:
        "## XAUUSD Weekly Outlook\n\nGold remains sensitive to USD strength and geopolitical headlines. This week we map premium supply zones above 2360 and demand near 2320.\n\n### Key Levels\n- Resistance: 2360–2375\n- Support: 2320–2305\n- Best session: London–NY overlap",
      coverUrl: SEED_IMAGES.blogCover4,
      categoryId: marketCategory.id,
      authorId: users.adminUser.id,
      isPremium: false,
    },
    {
      title: "Forex News: How Fed Rate Decisions Move USD Pairs",
      slug: "fed-rate-impact-usd-pairs",
      excerpt: "Understand how FOMC announcements affect EUR/USD, GBP/USD, and gold in the short term.",
      content:
        "## Fed Rate Impact\n\nWhen the Federal Reserve signals hawkish policy, USD typically strengthens across majors. Traders should watch the dot plot, Powell's tone, and CPI trends leading into the meeting.\n\n### Trading Tips\n- Reduce size before high-impact news\n- Wait for initial spike to settle\n- Trade structure, not headlines",
      coverUrl: SEED_IMAGES.blogCover5,
      categoryId: forexNewsCategory.id,
      authorId: users.adminUser.id,
      isPremium: false,
    },
    {
      title: "Trading Psychology: Overcoming Fear and Greed",
      slug: "trading-psychology-fear-greed",
      excerpt: "Practical mindset techniques to stay disciplined during winning and losing streaks.",
      content:
        "## Fear & Greed in Trading\n\nMost blown accounts come from emotional decisions — moving stops, over-leveraging after wins, or revenge trading after losses.\n\n### Discipline Framework\n1. Pre-define risk per trade (1% rule)\n2. Journal every session\n3. Step away after 2 consecutive losses\n4. Celebrate process, not P&L",
      coverUrl: SEED_IMAGES.blogCover6,
      categoryId: psychologyCategory.id,
      authorId: users.adminUser.id,
      isPremium: false,
    },
  ]

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        coverUrl: post.coverUrl,
        categoryId: post.categoryId,
        excerpt: post.excerpt,
        isPremium: post.isPremium,
      },
      create: { ...post, status: "PUBLISHED", publishedAt: new Date() },
    })
  }

  const digitalProducts = [
    {
      title: "Forex Trading Journal Template",
      slug: "forex-trading-journal",
      description: "Professional Excel trading journal with P&L tracking, risk metrics, and monthly reports.",
      type: "TRADING_JOURNAL" as const,
      thumbnailUrl: SEED_IMAGES.productJournal,
      fileKey: "forex-trading-journal.pdf",
      fileSize: 2048000,
      price: 0,
    },
    {
      title: "SMC & ICT Cheat Sheet",
      slug: "smc-ict-cheat-sheet",
      description: "Quick reference guide for Smart Money Concepts and ICT trading terminology.",
      type: "PDF" as const,
      thumbnailUrl: SEED_IMAGES.productPdf,
      fileKey: "smc-ict-cheatsheet.pdf",
      fileSize: 1024000,
      price: 9.99,
    },
    {
      title: "Risk Management Calculator",
      slug: "risk-management-calculator",
      description: "Excel-based position size calculator with lot sizing for forex pairs.",
      type: "TOOL" as const,
      thumbnailUrl: SEED_IMAGES.productTool,
      fileKey: "risk-calculator.xlsx",
      fileSize: 512000,
      price: 4.99,
    },
  ]

  for (const product of digitalProducts) {
    await prisma.digitalProduct.upsert({
      where: { slug: product.slug },
      update: { thumbnailUrl: product.thumbnailUrl },
      create: product,
    })
  }

  const physicalProducts = [
    {
      name: "FX Prime Academy Branded Notebook",
      slug: "branded-notebook",
      description: "Premium A5 notebook for trade journaling and market notes.",
      price: 450,
      currency: "BDT",
      stock: 50,
      images: [SEED_IMAGES.productNotebook],
    },
    {
      name: "Trading Desk Mouse Pad",
      slug: "trading-mouse-pad",
      description: "Large mouse pad with forex pair quick-reference chart.",
      price: 350,
      currency: "BDT",
      stock: 30,
      images: [SEED_IMAGES.productMousePad],
    },
  ]

  for (const product of physicalProducts) {
    await prisma.physicalProduct.upsert({
      where: { slug: product.slug },
      update: { images: product.images },
      create: product,
    })
  }

  const starterCourse = await prisma.course.findUnique({
    where: { slug: "forex-course-bangla" },
  })

  const liveSessions = [
    {
      title: "Weekly Market Review — Live Q&A",
      description: "Join our weekly live session for market analysis and Q&A with expert traders.",
      platform: "DEV",
      meetingUrl: "https://meet.dev.local/j/dev-seed-weekly-qa",
      meetingExternalId: "dev-seed-weekly-qa",
      scheduledAt: daysFromNow(7, 20),
      durationMinutes: 90,
      type: "PUBLIC_WEBINAR" as const,
      isPublic: true,
      requiresPremium: false,
      status: "SCHEDULED",
    },
    {
      title: "PRO Members: Advanced SMC Workshop",
      description: "Exclusive live workshop for PRO subscribers covering advanced Smart Money Concepts.",
      platform: "DEV",
      meetingUrl: "https://meet.dev.local/j/dev-seed-pro-smc",
      meetingExternalId: "dev-seed-pro-smc",
      scheduledAt: daysFromNow(14, 19),
      durationMinutes: 60,
      type: "QA_SESSION" as const,
      isPublic: true,
      requiresPremium: true,
      status: "SCHEDULED",
    },
    ...(starterCourse
      ? [
          {
            title: "Forex Starter Live Class — Chart Reading",
            description: "Live class for enrolled Forex Starter course students on candlestick chart reading.",
            platform: "DEV",
            meetingUrl: "https://meet.dev.local/j/dev-seed-bangla-class",
            meetingExternalId: "dev-seed-bangla-class",
            scheduledAt: daysFromNow(10, 18),
            durationMinutes: 75,
            type: "COURSE_CLASS" as const,
            courseId: starterCourse.id,
            isPublic: false,
            requiresPremium: false,
            status: "SCHEDULED",
          },
        ]
      : []),
  ]

  for (const session of liveSessions) {
    const existing = await prisma.liveSession.findFirst({
      where: { meetingExternalId: session.meetingExternalId },
    })
    if (existing) {
      await prisma.liveSession.update({
        where: { id: existing.id },
        data: {
          description: session.description,
          platform: session.platform,
          meetingUrl: session.meetingUrl,
          meetingExternalId: session.meetingExternalId,
          scheduledAt: session.scheduledAt,
          durationMinutes: session.durationMinutes,
          type: session.type,
          courseId: "courseId" in session ? session.courseId : null,
          isPublic: session.isPublic,
          requiresPremium: session.requiresPremium,
          status: session.status,
        },
      })
    } else {
      await prisma.liveSession.create({ data: session })
    }
  }

  const seedTestimonials = [
    {
      type: "VIDEO" as const,
      title: "Rakib — Forex Fundamentals Graduate",
      mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      authorName: "Rakib Hasan",
      sortOrder: 0,
    },
    {
      type: "VIDEO" as const,
      title: "Nusrat — Price Action Success Story",
      mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      authorName: "Nusrat Jahan",
      sortOrder: 1,
    },
    {
      type: "SCREENSHOT" as const,
      title: "WhatsApp Review — Tanvir",
      mediaUrl: SEED_IMAGES.courseAdvanced,
      authorName: "Tanvir Islam",
      sortOrder: 0,
    },
    {
      type: "SCREENSHOT" as const,
      title: "WhatsApp Review — Farhana",
      mediaUrl: SEED_IMAGES.courseBeginner,
      authorName: "Farhana Akter",
      sortOrder: 1,
    },
    {
      type: "SCREENSHOT" as const,
      title: "WhatsApp Review — Imran",
      mediaUrl: SEED_IMAGES.courseBangla,
      authorName: "Imran Hossain",
      sortOrder: 2,
    },
    {
      type: "TRUSTPILOT" as const,
      content:
        "Excellent mentorship and clear explanations. Highly recommend for beginners.",
      authorName: "Tanvir Islam",
      rating: 5,
      sortOrder: 0,
    },
    {
      type: "TRUSTPILOT" as const,
      content:
        "Live classes and practical assignments helped me finally understand market structure.",
      authorName: "Nusrat Jahan",
      rating: 5,
      sortOrder: 1,
    },
    {
      type: "TRUSTPILOT" as const,
      content: "Best Forex academy in Bangladesh. Mentor support is genuinely helpful.",
      authorName: "Rakib Hasan",
      rating: 5,
      sortOrder: 2,
    },
  ]

  for (const testimonial of seedTestimonials) {
    const existing = await prisma.testimonial.findFirst({
      where: testimonial.title
        ? { type: testimonial.type, title: testimonial.title }
        : {
            type: testimonial.type,
            authorName: testimonial.authorName,
            content: "content" in testimonial ? testimonial.content : undefined,
          },
    })
    if (existing) {
      await prisma.testimonial.update({ where: { id: existing.id }, data: testimonial })
    } else {
      await prisma.testimonial.create({ data: testimonial })
    }
  }
}
