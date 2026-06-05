// mock.js — Simulated API responses for testing without live API keys
// All data here is illustrative. Replace with real API calls once keys are configured.

const mockKeywordData = (keyword) => ({
  keyword,
  volume: 2400,
  difficulty: 38,
  cpc: 3.20,
  trend: 'growing',
  intent: 'commercial',
  serp_features: ['featured_snippet', 'people_also_ask', 'image_pack'],
  related_keywords: [
    { keyword: `best ${keyword}`, volume: 880, difficulty: 42 },
    { keyword: `${keyword} tool`, volume: 590, difficulty: 31 },
    { keyword: `${keyword} software`, volume: 1200, difficulty: 45 },
    { keyword: `how to use ${keyword}`, volume: 320, difficulty: 22 },
    { keyword: `${keyword} pricing`, volume: 480, difficulty: 29 },
  ],
  top_10: [
    { url: 'https://example-site-1.com/article', domain: 'example-site-1.com', da: 71, title: `Complete Guide to ${keyword}`, word_count: 2840, published: '2024-03-12' },
    { url: 'https://example-site-2.com/guide', domain: 'example-site-2.com', da: 64, title: `What is ${keyword}? Everything You Need to Know`, word_count: 2210, published: '2023-11-08' },
    { url: 'https://example-site-3.com/blog', domain: 'example-site-3.com', da: 58, title: `${keyword}: The Ultimate Breakdown`, word_count: 1980, published: '2024-01-20' },
    { url: 'https://example-site-4.com/post', domain: 'example-site-4.com', da: 49, title: `How ${keyword} Works in 2024`, word_count: 1650, published: '2024-05-01' },
    { url: 'https://example-site-5.com/resource', domain: 'example-site-5.com', da: 44, title: `${keyword} Explained for Beginners`, word_count: 1420, published: '2022-09-15' },
  ],
  paa_questions: [
    `What is ${keyword} and how does it work?`,
    `Is ${keyword} worth using for small businesses?`,
    `What are the main benefits of ${keyword}?`,
    `How much does ${keyword} typically cost?`,
    `What are the best alternatives to ${keyword}?`,
  ]
});

const mockRankabilityScore = (keyword, clientDA, keywordDifficulty, topResults) => {
  const avgCompetitorDA = topResults.slice(0, 5).reduce((sum, r) => sum + r.da, 0) / 5;
  const daGap = avgCompetitorDA - clientDA;
  const oldContent = topResults.filter(r => new Date(r.published) < new Date('2023-01-01')).length;

  let score = 100;
  score -= Math.max(0, daGap * 1.2);
  score -= keywordDifficulty * 0.4;
  score += oldContent * 8;

  score = Math.max(5, Math.min(95, Math.round(score)));

  let verdict, color, message, alternatives;
  if (score >= 60) {
    verdict = 'GREEN';
    color = 'green';
    message = `This keyword is winnable for ${clientDA} DA domain. Proceed to content execution.`;
    alternatives = [];
  } else if (score >= 35) {
    verdict = 'AMBER';
    color = 'amber';
    message = `This keyword is possible but competitive. Content alone may not be enough — link building recommended after publishing.`;
    alternatives = [
      { keyword: `${keyword} for beginners`, score: 72, reason: 'Lower competition, informational intent' },
      { keyword: `how to ${keyword}`, score: 68, reason: 'Long-tail, easier to rank' },
    ];
  } else {
    verdict = 'RED';
    color = 'red';
    message = `Domain authority gap is too large to rank competitively for this keyword right now.`;
    alternatives = [
      { keyword: `${keyword} guide`, score: 71, reason: 'Less competitive variation' },
      { keyword: `${keyword} tips`, score: 65, reason: 'Informational intent, lower DA requirements' },
      { keyword: `${keyword} explained`, score: 69, reason: 'Beginner-targeted, thin competition' },
    ];
  }

  return { score, verdict, color, message, alternatives, daGap: Math.round(daGap), avgCompetitorDA: Math.round(avgCompetitorDA) };
};

const mockSerpContent = (keyword) => ([
  {
    url: 'https://example-site-1.com/article',
    title: `Complete Guide to ${keyword}`,
    word_count: 2840,
    headings: [`What is ${keyword}?`, `How ${keyword} Works`, `Key Benefits`, `Getting Started`, `Common Mistakes`, `FAQ`],
    topics_covered: [`Definition and overview`, `Step-by-step setup`, `Pricing overview`, `3 main benefits`, `Basic FAQ (4 questions)`],
    missing: [`No comparison with alternatives`, `No real-world case studies`, `Statistics are from 2022`, `No advanced use cases`, `No ROI calculation guidance`]
  },
  {
    url: 'https://example-site-2.com/guide',
    title: `What is ${keyword}? Everything You Need to Know`,
    word_count: 2210,
    headings: [`Introduction`, `Core Features`, `Who Should Use It`, `Pricing`, `Verdict`],
    topics_covered: [`Basic definition`, `Feature list`, `Target audience overview`, `Pricing tiers`],
    missing: [`No setup instructions`, `No alternatives discussed`, `Very thin on technical detail`, `No FAQ section`, `No schema markup opportunities addressed`]
  },
  {
    url: 'https://example-site-3.com/blog',
    title: `${keyword}: The Ultimate Breakdown`,
    word_count: 1980,
    headings: [`Overview`, `How It Compares`, `Pros and Cons`, `Final Thoughts`],
    topics_covered: [`High-level overview`, `Brief competitor mention`, `Basic pros/cons list`],
    missing: [`No actionable how-to guidance`, `Pros/cons list is shallow`, `No data or statistics cited`, `No internal linking structure`, `No GEO-optimised summary paragraph`]
  }
]);

const mockGapAnalysis = (keyword) => ({
  recommended_angle: `A comprehensive, practitioner-focused guide that fills the data gap — include current statistics, a real-world ROI framework, and an honest comparison section that competitors avoid writing.`,
  must_cover: [
    `Clear definition with a direct-answer paragraph optimised for featured snippet capture`,
    `Step-by-step implementation guide (missing from all top 3)`,
    `Updated statistics with 2024/2025 sources`,
    `Comparison with top 3 alternatives (tabular format)`,
    `ROI calculation framework with worked example`,
    `Advanced use cases section (completely absent from top 3)`,
    `FAQ section addressing all 5 People Also Ask questions`,
  ],
  recommended_h2s: [
    `What Is ${keyword}? (Direct Answer)`,
    `How ${keyword} Works: A Step-by-Step Breakdown`,
    `Key Benefits of ${keyword} (With Data)`,
    `${keyword} vs Alternatives: Head-to-Head Comparison`,
    `How to Get Started With ${keyword}`,
    `Advanced ${keyword} Strategies`,
    `Common Mistakes to Avoid`,
    `Frequently Asked Questions`,
  ],
  recommended_word_count: 3100,
  differentiation_hook: `Include a simple ROI calculator or worked example — none of the top 3 do this, and it directly answers the unspoken question every reader has: "Is this worth it for me?"`
});

const mockArticle = (keyword, brief, client) => {
  const isUS = client.english_variant === 'en-US';
  const wordTarget = brief.recommended_word_count || 2000;

  return `# ${brief.recommended_h2s ? brief.recommended_h2s[0].replace('(Direct Answer)', '').trim() : keyword}

${keyword} is a ${isUS ? 'specialized' : 'specialised'} approach that helps businesses ${isUS ? 'optimize' : 'optimise'} their processes and achieve measurable results. In short: it is a system that automates repetitive decision-making so your team can focus on higher-value work.

## How ${keyword} Works: A Step-by-Step Breakdown

Understanding ${keyword} starts with recognising the core mechanism. At its foundation, the system continuously monitors relevant data points and applies predefined logic to produce consistent outcomes.

**Step 1: Data Collection**
The system pulls data from your existing sources in real time. No manual input is required once the initial ${isUS ? 'setup' : 'set-up'} is complete.

**Step 2: Analysis and Scoring**
Each data point is scored against your parameters. The system ${isUS ? 'prioritizes' : 'prioritises'} high-impact actions automatically.

**Step 3: Execution**
Actions are taken within the boundaries you define. You retain full control while removing manual bottlenecks.

## Key Benefits of ${keyword} (With Data)

Research from industry analysts shows that businesses adopting ${keyword} report a 34% reduction in manual workload within the first 90 days (Source: Industry Benchmark Report, 2024). The three primary benefits are:

1. **Time saved** — teams reclaim an average of 6.2 hours per week previously spent on manual tasks
2. **Consistency** — error rates drop by up to 41% when human decision fatigue is removed from routine processes
3. **Scalability** — the system handles increased volume without additional headcount

## ${keyword} vs Alternatives: Head-to-Head Comparison

| Feature | ${keyword} | Alternative A | Alternative B |
|---|---|---|---|
| Automation depth | High | Medium | Low |
| Setup complexity | Low | Medium | High |
| Pricing model | Subscription | Per-use | Flat fee |
| Support quality | 24/7 | Business hours | Email only |
| Best for | Growing teams | Enterprise | Solo operators |

## How to Get Started With ${keyword}

Getting started requires three things: an account, your existing data, and approximately 45 minutes for initial configuration.

**What you will need:**
- Access to your primary data source
- Your target parameters defined in advance
- A clear goal for what you want the system to achieve

Begin with a limited scope. Run the system on a small segment of your workflow for the first two weeks before expanding. This approach reduces risk and gives you clean performance data to ${isUS ? 'optimize' : 'optimise'} against.

## Advanced ${keyword} Strategies

Once the fundamentals are running smoothly, three advanced applications consistently deliver the strongest returns:

**1. Multi-variable scoring**
Rather than optimising for a single metric, configure the system to weight multiple variables simultaneously. Teams using this approach report 22% better outcomes than single-variable configurations.

**2. Scheduled review cycles**
Build a fortnightly review into your workflow. Markets shift, and parameters set three months ago may no longer reflect current conditions.

**3. Integration with reporting tools**
Connect your ${keyword} output to your existing reporting stack. Visibility drives better decisions about where to expand the system's scope.

## Common Mistakes to Avoid

The most frequently cited implementation failure is over-automating too quickly. Start narrow. The second most common error is neglecting to update parameters after initial setup. Treat your configuration as a living document, not a one-time task.

## Frequently Asked Questions

**What is ${keyword} and how does it work?**
${keyword} is a system that automates defined decision-making processes using real-time data. It works by continuously monitoring inputs, applying your logic rules, and executing actions within boundaries you set.

**Is ${keyword} worth using for small businesses?**
Yes, provided the volume of decisions being automated justifies the setup time. Businesses processing more than 50 routine decisions per week typically see positive ROI within 60 days.

**What are the main benefits of ${keyword}?**
The three primary benefits are time savings, consistency, and scalability. Most users report reclaiming 5 to 7 hours per week after the first month.

**How much does ${keyword} typically cost?**
Pricing varies by provider and usage volume. Entry-level plans typically range from $49 to $149 per month, with enterprise tiers available for high-volume operations.

**What are the best alternatives to ${keyword}?**
The strongest alternatives depend on your specific use case. Manual processes work for very low volume. Dedicated enterprise tools suit large teams with complex requirements. ${keyword} sits in the middle ground and serves most growing businesses well.`;
};

const mockCannibalisation = (keyword, sitemapUrl) => ({
  checked: !!sitemapUrl,
  conflict_found: false,
  conflicting_url: null,
  message: sitemapUrl
    ? `No existing page found targeting "${keyword}" or close variations.`
    : `No sitemap URL configured for this client. Cannibalisation check skipped.`
});

module.exports = {
  mockKeywordData,
  mockRankabilityScore,
  mockSerpContent,
  mockGapAnalysis,
  mockArticle,
  mockCannibalisation
};
