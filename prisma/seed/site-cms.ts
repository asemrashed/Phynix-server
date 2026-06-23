import type { PrismaClient } from "@prisma/client"

const ABOUT_HTML = `<p>
FX Prime Academy is a UK-registered Forex education platform dedicated to helping traders
build real market skills through structured courses, live analysis, and mentor support.
</p>
<h2>Our Mission</h2>
<p>
We make professional trading education accessible in English — combining live
classes, practical assignments, community support, and verified certificates.
</p>
<h2>What We Offer</h2>
<ul>
<li>Beginner to advanced Forex courses</li>
<li>Free learning resources — courses, ebooks, and market analysis</li>
<li>1-on-1 consultation for trading, career, and study abroad guidance</li>
<li>Live market sessions and mentorship</li>
<li>QR-verifiable certificates</li>
</ul>
<h2>Contact</h2>
<p>
Email: <a href="mailto:support@fxprimeacademy.com">support@fxprimeacademy.com</a><br />
Address: 128 City Road, London, EC1V 2NX<br />
<a href="/contact">Send us a message</a>
</p>`

const TERMS_HTML = `<p>Last updated: June 2026</p>
<h2>Acceptance of Terms</h2>
<p>
By accessing FX Prime Academy, you agree to these terms. If you do not agree, please do not
use our platform.
</p>
<h2>Educational Content</h2>
<p>
All course materials, videos, and resources are for educational purposes only. Trading
involves substantial risk. Past performance does not guarantee future results. We do not
provide financial advice or guaranteed returns.
</p>
<h2>Accounts</h2>
<p>
You are responsible for maintaining the confidentiality of your account credentials. Sharing
login access may result in account suspension.
</p>
<h2>Intellectual Property</h2>
<p>
Course content, branding, and materials are owned by FX Prime Academy. Unauthorized
reproduction or distribution is prohibited.
</p>
<h2>Limitation of Liability</h2>
<p>
FX Prime Academy is not liable for trading losses or damages arising from use of our
educational content or platform.
</p>`

const PRIVACY_HTML = `<p>Last updated: June 2026</p>
<h2>Information We Collect</h2>
<p>
We collect information you provide when registering, enrolling in courses, making purchases,
or contacting support — including name, email, phone, and payment-related data processed by
our payment partners.
</p>
<h2>How We Use Your Information</h2>
<ul>
<li>To provide courses, certificates, and platform features</li>
<li>To process payments and orders</li>
<li>To send important account and course updates</li>
<li>To improve our services and support</li>
</ul>
<h2>Data Security</h2>
<p>
We use industry-standard security measures to protect your data. Passwords are hashed and
payment details are handled by certified payment gateways — we do not store card numbers.
</p>
<h2>Your Rights</h2>
<p>
You may request access, correction, or deletion of your personal data by emailing
support@fxprimeacademy.com.
</p>
<h2>Contact</h2>
<p>FX Prime Academy — support@fxprimeacademy.com</p>`

const REFUND_HTML = `<p>Last updated: June 2026</p>
<h2>Digital Courses &amp; Products</h2>
<p>
Refund requests for digital courses and products may be submitted within 7 days of purchase
if less than 20% of the course content has been accessed. Contact support@fxprimeacademy.com
with your order details.
</p>
<h2>Consultation &amp; Mentorship</h2>
<p>
Consultation sessions cancelled at least 24 hours before the scheduled time are eligible for
a full refund or reschedule. Late cancellations may not be refunded.
</p>
<h2>Physical Products</h2>
<p>
Physical products may be returned within 7 days if unused and in original packaging. Shipping
costs for returns are borne by the customer unless the item is defective.
</p>
<h2>Processing</h2>
<p>
Approved refunds are processed within 7–14 business days to the original payment method.
</p>`

const COOKIES_HTML = `<p>Last updated: June 2026</p>
<h2>What Are Cookies</h2>
<p>
Cookies are small text files stored on your device to help our website function and improve
your experience.
</p>
<h2>Cookies We Use</h2>
<ul>
<li><strong>Essential cookies</strong> — required for login, session management, and security</li>
<li><strong>Preference cookies</strong> — remember your settings and preferences</li>
<li><strong>Analytics cookies</strong> — help us understand how visitors use the platform</li>
</ul>
<h2>Managing Cookies</h2>
<p>
You can control cookies through your browser settings. Disabling essential cookies may
affect platform functionality such as staying logged in.
</p>
<h2>Contact</h2>
<p>Questions about cookies: support@fxprimeacademy.com</p>`

const CONTACT_FAQ = [
  {
    question: "How quickly will I get a reply?",
    answer:
      "We typically respond within 24–48 hours during Bangladesh business hours (Monday–Saturday, 10 AM–6 PM BDT).",
  },
  {
    question: "I have a payment or refund question — what should I include?",
    answer:
      "Include your registered email, order or transaction reference, and a short description of the issue. You can also review our refund policy before submitting.",
  },
  {
    question: "How is consultation different from general support?",
    answer:
      "General support covers account, enrollment, and payment questions. Consultation is a paid 1-on-1 mentor session for trading, career, or study-abroad guidance — book it from the Consultation page.",
  },
  {
    question: "Do I need an account to contact us?",
    answer:
      "No. Anyone can submit the contact form. If you are logged in, we automatically link your inquiry to your account for faster support.",
  },
  {
    question: "Where is FX Prime Academy located?",
    answer:
      "Our office is at 128 City Road, London, EC1V 2NX. Online support is available for students worldwide.",
  },
]

const FOOTER_TAGLINE_DEFAULT =
  "Premium Forex education platform for traders in Bangladesh and worldwide. Learn professional trading with live classes, mentor support, and verified certificates."

const FOOTER_DEFAULT = {
  brandName: "FX Prime Academy",
  brandTagline: FOOTER_TAGLINE_DEFAULT,
  quickLinksTitle: "Quick Links",
  companyLinksTitle: "Company",
  contactTitle: "Contact",
  socialTitle: "Connect With Us",
  quickLinks: [
    { href: "/courses", label: "All Courses" },
    { href: "/courses?free=true", label: "Free Courses" },
    { href: "/consultation", label: "Consultation" },
    { href: "/live", label: "Live Sessions" },
    { href: "/blog", label: "Blog" },
  ],
  companyLinks: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact Us" },
    { href: "/refund-policy", label: "Refund Policy" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
  bottomLinks: [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/cookies", label: "Cookies" },
  ],
  socialLinks: [{ platform: "youtube", href: "https://www.youtube.com" }],
  copyrightText: "FX Prime Academy. All rights reserved.",
}

const CONTACT_PAGE_DEFAULT = {
  eyebrow: "Contact",
  title: "Get in touch",
  description:
    "Questions about courses, payments, or consultations? Our team supports students in Bangladesh and worldwide.",
  formTitle: "Send us a message",
  formSubtitle: "Fill out the form and we'll get back to you within 24–48 hours.",
}

const CONSULTATION_PAGE_DEFAULT = {
  title: "Consultation Services",
  description:
    "Book a private 1-on-1 session with our expert mentors. Choose your consultation type and pick a time that works for you.",
}

const HOMEPAGE_SECTIONS = [
  {
    key: "hero",
    eyebrow: "Professional Forex Education in English",
    title: "Master Forex Trading with Institutional-Level Education",
    description:
      "Learn Smart Money Concepts (SMC), ICT Methodology, Risk Management, and Professional Trading Skills through structured courses, mentorship, and real-market insights designed for serious traders.",
    items: [],
    ctaPrimary: { label: "Join Course", href: "/courses" },
    ctaSecondary: { label: "Book Consultation", href: "/consultation" },
    metadata: {},
  },
  {
    key: "risk_disclaimer",
    eyebrow: null,
    title: null,
    description:
      "Trading carries a high risk of loss. Content is for educational purposes only and is not financial advice. FX Prime Academy does not guarantee profits or returns.",
    items: [],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: { label: "Risk Disclaimer:" },
  },
  {
    key: "trust_bar",
    eyebrow: null,
    title: null,
    description: null,
    items: [
      { icon: "Building2", title: "UK Registered Company", description: "" },
      { icon: "Users", title: "1000+ Students", description: "", statKey: "students" },
      { icon: "LineChart", title: "Live Market Analysis", description: "" },
      { icon: "UserCheck", title: "Expert Mentorship", description: "" },
    ],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: {},
  },
  {
    key: "featured_courses",
    eyebrow: "Featured Courses",
    title: "Start Your Forex Journey",
    description: "English courses from beginner basics to advanced price action",
    items: [],
    ctaPrimary: { label: "View All Courses", href: "/courses" },
    ctaSecondary: null,
    metadata: { eyebrowVariant: "destructive" },
  },
  {
    key: "free_learning_hub",
    eyebrow: "Free Resources",
    title: "Free Learning Hub",
    description:
      "Everything you need to start — courses, videos, ebooks, and live market insights at no cost",
    items: [
      {
        icon: "BookOpen",
        title: "Free Course",
        description: "Start learning Forex fundamentals at zero cost",
        href: "/courses?free=true",
      },
      {
        icon: "Youtube",
        title: "YouTube Channel",
        description: "Daily market analysis and free trading lessons",
        href: "https://www.youtube.com",
        external: true,
      },
      {
        icon: "FileText",
        title: "Free Ebooks",
        description: "Download guides on trading psychology & strategy",
        href: "/marketplace?type=digital&free=true",
      },
      {
        icon: "TrendingUp",
        title: "Market Analysis",
        description: "XAUUSD, Forex news & ICT concepts explained",
        href: "/blog/category/market-analysis",
      },
    ],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: {},
  },
  {
    key: "pricing",
    eyebrow: "Live sessions",
    title: "Free webinars or PRO live sessions",
    description:
      "Start with free public webinars on the live desk, or upgrade to PRO for exclusive Q&A and mentorship sessions.",
    items: [],
    ctaPrimary: { label: "View full pricing details", href: "/pricing" },
    ctaSecondary: null,
    metadata: {
      footnote: "Payment method is selected on the checkout step after you choose to upgrade.",
    },
  },
  {
    key: "why_choose",
    eyebrow: "Why FX Prime Academy",
    title: "Why Choose Us",
    description: "Everything you need to become a confident, disciplined trader",
    items: [
      {
        icon: "Video",
        title: "Live Classes",
        description: "Interactive sessions with real-time chart analysis and Q&A",
      },
      {
        icon: "Infinity",
        title: "Lifetime Access",
        description: "Revisit course materials and updates whenever you need them",
      },
      {
        icon: "Users",
        title: "Trading Community",
        description: "Connect with fellow traders, share setups, and grow together",
      },
      {
        icon: "Handshake",
        title: "Mentor Support",
        description: "Direct access to experienced mentors for guidance and feedback",
      },
      {
        icon: "Bot",
        title: "AI Learning Tools",
        description: "Smart quizzes, progress tracking, and AI-powered study aids",
      },
      {
        icon: "ClipboardCheck",
        title: "Practical Assignments",
        description: "Apply what you learn with real chart work and graded tasks",
      },
    ],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: {},
  },
  {
    key: "consultation",
    eyebrow: "Expert Guidance",
    title: "Consultation Services",
    description:
      "Book a private session with our mentors — tailored advice for your trading and career goals",
    items: [
      {
        icon: "Briefcase",
        title: "Career Consultation",
        description: "Map your path into finance, trading careers, and professional growth",
        type: "career",
      },
      {
        icon: "Globe",
        title: "Study Abroad Guidance",
        description: "University applications, scholarships, and finance programs overseas",
        type: "study-abroad",
      },
      {
        icon: "TrendingUp",
        title: "Trading Consultation",
        description: "1-on-1 strategy review, risk management, and live market guidance",
        type: "trading",
      },
      {
        icon: "Building2",
        title: "Business Consultation",
        description: "Prop firm setup, trading business models, and scaling advice",
        type: "business",
      },
    ],
    ctaPrimary: { label: "View All Consultation Options", href: "/consultation" },
    ctaSecondary: null,
    metadata: {},
  },
  {
    key: "testimonials",
    eyebrow: "Student Success",
    title: "Student Success & Reviews",
    description:
      "Video reviews, screenshot testimonials, and Trustpilot ratings from our community",
    items: [],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: { emptyMessage: "Student reviews coming soon." },
  },
  {
    key: "lead_mentor",
    eyebrow: "Meet Your Mentor",
    title: "Learn from experienced traders",
    description: "One-on-one mentorship for your Forex journey",
    items: [],
    ctaPrimary: { label: "Book a Session", href: "/consultation" },
    ctaSecondary: null,
    metadata: { headlineFallback: "Founder & Lead Mentor, FX Prime Academy" },
  },
  {
    key: "latest_insights",
    eyebrow: "Market Insights",
    title: "Latest Insights & Blog",
    description: "XAUUSD analysis, Forex news, trading psychology, ICT concepts and more",
    items: [],
    ctaPrimary: { label: "View All Insights", href: "/blog" },
    ctaSecondary: null,
    metadata: {
      emptyMessage:
        "New market insights coming soon. Check back for XAUUSD analysis and trading tips.",
    },
  },
  {
    key: "final_cta",
    eyebrow: null,
    title: "Start Your Trading Journey Today",
    description:
      "Join thousands of students learning professional Forex trading with live classes, mentor support, and a thriving community.",
    items: [],
    ctaPrimary: { label: "Join Course", href: "/courses" },
    ctaSecondary: { label: "Book Consultation", href: "/consultation" },
    metadata: {},
  },
  {
    key: "app_download",
    eyebrow: null,
    title: "Download the FX Prime Academy App",
    description:
      "Access courses offline, join live sessions, track progress, and get market updates on the go.",
    items: [],
    ctaPrimary: null,
    ctaSecondary: null,
    metadata: {},
  },
]

const CONSULTATION_TYPES = [
  {
    slug: "career",
    type: "CAREER" as const,
    label: "Career Consultation",
    description: "Finance careers, trading jobs, and professional growth",
    specialization: "Career",
    sortOrder: 0,
  },
  {
    slug: "study-abroad",
    type: "STUDY_ABROAD" as const,
    label: "Study Abroad Guidance",
    description: "University applications and finance programs overseas",
    specialization: "Study Abroad",
    sortOrder: 1,
  },
  {
    slug: "trading",
    type: "TRADING" as const,
    label: "Trading Consultation",
    description: "Strategy review, risk management, live market guidance",
    specialization: "Trading",
    sortOrder: 2,
  },
  {
    slug: "business",
    type: "BUSINESS" as const,
    label: "Business Consultation",
    description: "Prop firm setup, trading business, and scaling",
    specialization: "Business",
    sortOrder: 3,
  },
]

const SITE_PAGES = [
  {
    slug: "about",
    title: "About FX Prime Academy",
    description: "Professional Forex education for traders in Bangladesh and worldwide.",
    contentHtml: ABOUT_HTML,
    seoTitle: "About Us — FX Prime Academy",
    seoDescription: "Learn about FX Prime Academy — UK registered Forex education platform.",
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    description: null,
    contentHtml: TERMS_HTML,
    seoTitle: "Terms & Conditions — FX Prime Academy",
    seoDescription: null,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: null,
    contentHtml: PRIVACY_HTML,
    seoTitle: "Privacy Policy — FX Prime Academy",
    seoDescription: null,
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    description: null,
    contentHtml: REFUND_HTML,
    seoTitle: "Refund Policy — FX Prime Academy",
    seoDescription: null,
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    description: null,
    contentHtml: COOKIES_HTML,
    seoTitle: "Cookie Policy — FX Prime Academy",
    seoDescription: null,
  },
]

export async function seedSiteCms(prisma: PrismaClient) {
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      supportEmail: "support@fxprimeacademy.com",
      officeAddress: { line1: "128 City Road", line2: "London, EC1V 2NX" },
      officeHours: "Mon–Sat, 10:00 AM – 6:00 PM (BDT)",
      contactFaq: CONTACT_FAQ,
      contactPage: CONTACT_PAGE_DEFAULT,
      consultationPage: CONSULTATION_PAGE_DEFAULT,
      footerTagline: FOOTER_TAGLINE_DEFAULT,
      footer: FOOTER_DEFAULT,
    },
    update: {},
  })

  const settings = await prisma.siteSettings.findUnique({ where: { id: "default" } })
  if (settings) {
    const patch: Record<string, unknown> = {}
    const contactPage = settings.contactPage as Record<string, unknown> | null
    const consultationPage = settings.consultationPage as Record<string, unknown> | null
    if (!contactPage || Object.keys(contactPage).length === 0) {
      patch.contactPage = CONTACT_PAGE_DEFAULT
    }
    if (!consultationPage || Object.keys(consultationPage).length === 0) {
      patch.consultationPage = CONSULTATION_PAGE_DEFAULT
    }
    if (!settings.footerTagline?.trim()) {
      patch.footerTagline = FOOTER_TAGLINE_DEFAULT
    }
    const footer = settings.footer as Record<string, unknown> | null
    if (!footer || Object.keys(footer).length === 0) {
      patch.footer = FOOTER_DEFAULT
    }
    if (Object.keys(patch).length > 0) {
      await prisma.siteSettings.update({ where: { id: "default" }, data: patch })
    }
  }

  for (const page of SITE_PAGES) {
    await prisma.sitePage.upsert({
      where: { slug: page.slug },
      create: page,
      update: {},
    })
  }

  for (const section of HOMEPAGE_SECTIONS) {
    const sectionData = {
      eyebrow: section.eyebrow,
      title: section.title,
      description: section.description,
      items: section.items,
      ctaPrimary: section.ctaPrimary ?? undefined,
      ctaSecondary: section.ctaSecondary ?? undefined,
      metadata: section.metadata,
    }
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      create: { key: section.key, ...sectionData },
      update: section.key === "hero" ? sectionData : {},
    })
  }

  for (const item of CONSULTATION_TYPES) {
    await prisma.consultationTypeConfig.upsert({
      where: { slug: item.slug },
      create: item,
      update: {},
    })
  }
}
