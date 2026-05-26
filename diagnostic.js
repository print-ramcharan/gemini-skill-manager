const path = require('path');
const fs = require('fs');
const os = require('os');

const homeDir = os.homedir();
const skillsDir = path.join(homeDir, '.gemini/config/skills');
const backupDir = path.join(homeDir, '.gemini/config/skills_backup');

// Category Mapping rules
const CATEGORY_MAP = [
  {
    name: 'Azure Cloud Services',
    prefix: ['azure']
  },
  {
    name: 'Odoo & ERP Enterprise',
    prefix: ['odoo', 'salesforce', 'dynamics', 'sap', 'wrike', 'zendesk']
  },
  {
    name: 'Science, Bio & Medicine',
    prefix: ['literature-search', 'clinical-trials', 'chembl', 'pubmed', 'uniprot', 'alphafold', 'protein', 'clinvar', 'gnomad', 'dbsnp', 'jaspar', 'biopython', 'science', 'reactome', 'quickgo', 'pubchem', 'ucsc', 'unibind', 'embl', 'fda-', 'scanpy', 'sympy', 'variant-analysis']
  },
  {
    name: 'Legal, Patents & PT Auctions',
    prefix: ['leiloeiro', 'advogado', 'junta-leiloeiros', 'lex']
  },
  {
    name: 'Functional Programming & Async',
    prefix: ['fp-', 'functional-programming']
  },
  {
    name: 'Workflow Automation & Scripting',
    prefix: [
      'automation', 'workflow', 'zapier', 'trigger', 'make-', 'bash', 'scripting', 'ssh', 'tmux', 'cron', 
      'n8n', 'twilio', 'web-scraper', 'firecrawl-scraper'
    ]
  },
  {
    name: 'AWS & DevOps Cloud',
    prefix: [
      'aws', 'cdk', 'terraform', 'kubernetes', 'k8s', 'helm', 'docker', 'gcp', 'cloudflare', 'gitlab', 'github', 
      'secrets', 'deployment', 'gitops', 'ci-cd', 'jenkins', 'observability', 'prometheus', 'grafana', 'datadog', 
      'render-', 'devcontainer', 'cloud-architect', 'cloud-devops', 'cloudformation', 'service-mesh', 'network-101', 
      'network-engineer', 'mtls-', 'slo-implementation', 'appdeploy', 'server-management', 'build', 'devops', 'setup-guide',
      'cloud', 'networking'
    ]
  },
  {
    name: 'Mobile App Development (Apple & Android)',
    prefix: ['android', 'ios', 'swift', 'kotlin', 'flutter', 'mobile', 'xcode', 'swiftui', 'expo-', 'robius', 'upgrading-expo', 'app-store', 'multi-platform']
  },
  {
    name: 'AI Models, Frameworks & RAG',
    prefix: [
      'ai-', 'ml-', 'machine-learning', 'numpy', 'pandas', 'scikit', 'matplotlib', 'astropy', 'cirq', 'qiskit', 
      'hugging', 'fal-', 'transformers', 'gemini-api', 'openai', 'claude-', 'rag-', 'tavily', 'stability', 
      'earllm', 'voice-', 'videodb', 'comfyui', 'agent', 'copilot', 'llm-', 'llm-app', 'prompt', 'langfuse', 
      'langgraph', 'vector-', 'mcp-', 'embedded-strategies', 'deep-research', 'crewai', 'subagent', 'computer-use',
      'computer-vision', 'audio-transcriber', 'imagen', 'jobgpt', 'podcast-', 'seek-and-analyze', 'task-intelligence',
      'youtube-summarizer', 'advanced-evaluation', 'context-', 'context7', 'conversation-memory', 'embedding-', 'search',
      'bdi-mental', 'bdistill', 'adhx', 'tool-use', '-ai', 'mlops', 'advisor'
    ]
  },
  {
    name: 'AI Personas & Philosophies',
    prefix: [
      'sam-altman', 'yann-lecun', 'elon-musk', 'steve-jobs', 'bill-gates', 'geoffrey-hinton', 'warren-buffett', 
      'nerdzao', 'moyu', 'viboscope', 'explain-like-socrates', 'karpathy', 'ilya-sutskever', 'matematico-tao', '007'
    ]
  },
  {
    name: 'Backend Frameworks & Server APIs',
    prefix: [
      'fastapi', 'django', 'hono', 'graphql', 'trpc', 'rest', 'api-', 'pydantic', 'nodejs', 'express', 'nestjs', 
      'backend', 'saas', 'billing', 'stripe', 'paypal', 'payment', 'zustand', 'supabase', 'socket', 'websockets', 
      'laravel', 'zod-', 'clerk-auth', 'bullmq', 'algolia-search', 'inngest', 'plaid-fintech', 'upstash-', 'firebase'
    ]
  },
  {
    name: 'Databases & Data Engineering',
    prefix: [
      'database', 'sql', 'postgres', 'prisma', 'mongodb', 'nosql', 'redis', 'convex', 'neon-', 'snowflake', 
      'clickhouse', 'dbt', 'spark', 'polars', 'airflow', 'kafka', 'data-engineering', 'data-quality', 'data-scientist', 
      'postgresql', 'drizzle-orm', 'geo-fundamentals', 'plotly', 'seaborn', 'statsmodels', 'networkx', 'using-neon', 'data-'
    ]
  },
  {
    name: 'Core Languages',
    prefix: ['python', 'golang', 'go-', 'rust', 'cpp', 'c-pro', 'csharp', 'java', 'ruby', 'rails', 'php', 'haskell', 'julia', 'typescript', 'javascript', 'dotnet', 'scala', 'elixir', 'uv-package-manager']
  },
  {
    name: '3D Graphics, Animations & UI Design',
    prefix: [
      'threejs', 'spline', 'glsl', 'shader', 'canvas', 'animejs', 'remotion', 'popmotion', 'scroll-experience', 
      'vizcom', 'algorithmic-art', 'image-studio', 'brand-guidelines', 'design-spells', 'design-md', 'ui-skills', 
      'ui-ux', 'hig-', 'radix', 'shadcn', 'tailwind', 'layout', 'components', 'theme-', 'css', 'html', 'visual', 
      'a11y', 'accessibility', 'web-design', '3d-web', 'baseline-ui', 'favicon', 'iconsax', 'kpi-dashboard', 
      'mermaid-expert', 'stitch-loop', 'stitch-ui', 'theme-factory', 'design-'
    ]
  },
  {
    name: 'Web3, Blockchain & Crypto',
    prefix: ['nft', 'solidity', 'smart-contract', 'web3', 'ethereum', 'crypto', 'defi', 'bitcoin', 'lightning-', 'solidity-security', 'blockchain-developer', 'blockrun']
  },
  {
    name: 'Chatbots & Chat Integrations',
    prefix: ['telegram', 'slack', 'whatsapp', 'discord', 'teams', 'zoom', 'microsoft-teams', 'chat-widget']
  },
  {
    name: 'Personal Knowledge Base & Wikis',
    prefix: [
      'obsidian', 'wiki-', 'diary', 'agent-memory', 'notion', 'notebooklm', 'documentation', 'readme', 'docs', 
      'blog-writing', 'beautiful-prose', 'copy-editing', 'latex-paper', 'professional-proofreader', 'tutorial-engineer',
      'writing-plans', 'writing-skills', 'yes-md', 'reference-builder', 'plan-', 'planning', 'citation-', 'emergency-card',
      'fixing-metadata', 'infinite-gratitude', 'last30days', 'loki-mode', 'postmortem-', 'brainstorming'
    ]
  },
  {
    name: 'Productivity & Collaboration Software',
    prefix: [
      'product-manager', 'office', 'ppt', 'pdf', 'excel', 'word', 'docx', 'xlsx', 'pptx', 'hubspot', 'jira', 
      'asana', 'trello', 'brevo', 'outlook', 'gmail', 'google-', 'confluence', 'wrike', 'monday-', 'daily', 
      'onboarding', 'interview-coach', 'linear', 'progressive-estimation', 'team-collaboration', 'team-composition',
      'track-management', 'personal-tool-builder', 'screenshots', 'executing-plans', 'internal-comms'
    ]
  },
  {
    name: 'SEO, Marketing & Social Media',
    prefix: [
      'seo', 'marketing', 'apify', 'lead', 'social', 'growth', 'paid-ads', 'email', 'copywriting', 'ads', 
      'landing-page', 'analytics', 'amplitude', 'posthog', 'mixpanel', 'referral', 'viral', 'ad-creative', 
      'content-creator', 'content-strategy', 'instagram', 'linkedin-cli', 'schema-markup', 'segment-cdp', 
      'x-article', 'x-twitter-scraper'
    ]
  },
  {
    name: 'Security & Vulnerability Auditing',
    prefix: [
      'pentest', 'security', 'red-team', 'malware', 'burp', 'active-directory', 'vulnerability', 'attack', 
      'ethical-hacking', 'solidity-security', 'sast', 'sec-', 'idor', 'shodan', 'scanning', 'fuzzing', 
      'privilege', 'reverse-engineer', 'zeroize', 'sqlmap', 'metasploit', 'xss', 'anti-reversing', 'broken-authentication',
      'pci-compliance', 'privacy-by-design', 'semgrep', 'threat-mitigation', 'threat-modeling', 'top-web-vulnerabilities', 
      'wireshark'
    ]
  },
  {
    name: 'Systems & Hardware Programming',
    prefix: [
      'embedded', 'firmware', 'c-', 'cpp', 'assembly', 'arm', 'systems-programming', 'dwarf', 'gdb', 'binary', 
      'memory-', 'linux-shell', 'linux-troubleshooting', 'posix-shell', 'powershell', 'bash-linux', 'bash-pro', 
      'bash-scripting', 'os-scripting', 'busybox-on-windows', 'filesystem-context', 'file-organizer', 'file-path-traversal',
      'pypict-skill', 'sharp-edges', 'tmux', 'varlock', 'vexor', 'windows-shell', 'jq', 'molykit'
    ]
  },
  {
    name: 'Browser Extensions & Web Tools',
    prefix: ['chrome-extension', 'browser-extension', 'firefox']
  },
  {
    name: 'System Design & Coding Patterns',
    prefix: [
      'architecture', 'c4-', 'patterns', 'ddd-', 'monorepo', 'nx-', 'refactor', 'cleanup', 'kaizen', 
      'simplifier', 'clean-code', 'analyze-project', 'architect-review', 'ask-questions-if-underspecified', 
      'auri-core', 'blueprint', 'clarity-gate', 'codebase-audit', 'codebase-cleanup', 'cqrs-', 'development', 
      'domain-driven-design', 'event-sourcing', 'event-store', 'evolution', 'framework-migration', 'legacy-modernizer',
      'project-development', 'project-skill-audit', 'saga-orchestration', 'senior-architect', 'senior-fullstack', 
      'simplify-code', 'tool-design', 'turborepo-caching', 'uncle-bob', 'constant-time-analysis', 'event-store-design',
      'audit-', 'spdd', 'full-stack-orchestration'
    ]
  },
  {
    name: 'Git, PR & Version Control',
    prefix: ['git-', 'pr-writer', 'create-pr', 'create-branch', 'git-worktrees', 'review-requests', 'commit', 'gh-review-requests', 'git-pushing', 'iterate-pr']
  },
  {
    name: 'Andruia Consultant & Agent Ecosystem',
    prefix: [
      '00-andruia', '10-andruia', '20-andruia', 'andruia', 'antigravity', 'maxia', 
      'skill-check', 'skill-creator', 'skill-developer', 'skill-improver', 'skill-installer', 'skill-router', 
      'skill-scanner', 'skill-seekers', 'skill-sentinel', 'skill-writer', 'superpowers-lab', 'using-superpowers'
    ]
  },
  {
    name: 'Business Strategy & CRO Optimization',
    prefix: [
      'cro', 'pricing', 'startup', 'business', 'monetization', 'sred', 'competitor', 'market', 'revops', 'billing',
      'carrier-relationship', 'churn-prevention', 'competitive-landscape', 'customs-trade', 'employment-contract', 
      'energy-procurement', 'free-tool', 'gdpr-data', 'hr-pro', 'inventory-demand', 'launch-strategy', 'legal-advisor', 
      'logistics-exception', 'quality-nonconformance', 'quant-analyst', 'recallmax', 'returns-reverse', 'risk-manager', 
      'risk-metrics', 'sales-automator', 'sales-enablement', 'supply-chain', 'xvary-stock', 'product-', 'custom-',
      'closed-loop', 'cost-optimization', 'alpha-vantage', 'cred-omega', 'customer-support', 'production-scheduling'
    ]
  },
  {
    name: 'Quality Assurance, Testing & Perf',
    prefix: [
      'testing', 'test-', 'tdd', '-test', 'e2e', 'playwright', 'cypress', 'bug', 'debug', 'error', 'perf', 
      'performance', 'diagnostics', 'validation', 'acceptance-orchestrator', 'clarvia-aeo-check', 'code-review', 
      'code-reviewer', 'codex-review', 'comprehensive-review', 'conductor-', 'defuddle', 'dependency-management', 
      'dependency-upgrade', 'differential-review', 'distributed-tracing', 'dx-optimizer', 'evaluation', 
      'incident-', 'issues', 'lint-and-validate', 'oss-hunter', 'production-code-audit', 'receiving-code-review', 
      'requesting-code-review', 'shellcheck-configuration', 'speckit-updater', 'speed', 'verification-before', 
      'vibe-code', 'vibers-code', 'fix-review', 'create-issue-gate'
    ]
  },
  {
    name: 'Health, Wellness & Medicine',
    prefix: [
      'health', 'fitness', 'nutrition', 'wellness', '-analyzer', 'medical', 'clinical', 'oral', 'dental', 'sleep', 
      'rehabilitation', 'anatomy', 'physio', 'wellally-tech', 'stride-analysis'
    ]
  },
  {
    name: 'Frontend & UI Frameworks',
    prefix: [
      'react', 'angular', 'nextjs', 'expo', 'shopify', 'wordpress', 'svelte', 'hono', 'vite', 'nextlevel', 
      'astro', 'vue', 'nuxt', 'remix', 'solidjs', 'lit-', 'progressive-web', 'tanstack-query', 'unsplash-integration',
      'web-artifacts-builder', 'app-builder', 'frontend', 'building-native-ui', 'i18n-localization', 'interactive-',
      'manifest', 'native-data-'
    ]
  },
  {
    name: 'Game Dev & 3D Shaders',
    prefix: ['bevy', 'godot', 'game-', 'minecraft', 'unreal', 'unity', 'game-development']
  },
  {
    name: 'Desktop App Development',
    prefix: ['electron-development', 'avalonia-layout-zafiro', 'avalonia-viewmodels-zafiro', 'avalonia-zafiro-development', 'macos-menubar', 'macos-spm', 'makepad']
  }
];

function getCategory(skillId) {
  const lowercaseId = skillId.toLowerCase();
  for (const cat of CATEGORY_MAP) {
    if (cat.prefix.some(p => {
      if (p.endsWith('-') && lowercaseId.startsWith(p)) return true;
      if (p.startsWith('-') && lowercaseId.endsWith(p)) return true;
      return lowercaseId.includes(p);
    })) {
      return cat.name;
    }
  }
  return 'General Development Tools';
}

const folders = [];
if (fs.existsSync(skillsDir)) folders.push(...fs.readdirSync(skillsDir));
if (fs.existsSync(backupDir)) folders.push(...fs.readdirSync(backupDir));

const uniqueFolders = Array.from(new Set(folders)).filter(f => !f.startsWith('.'));

const distribution = {};
const unmapped = [];

uniqueFolders.forEach(f => {
  const cat = getCategory(f);
  distribution[cat] = (distribution[cat] || 0) + 1;
  if (cat === 'General Development Tools') {
    unmapped.push(f);
  }
});

console.log('--- DISTRIBUTION ---');
console.log(JSON.stringify(distribution, null, 2));

console.log('\n--- FIRST 50 UNMAPPED SKILLS ---');
console.log(unmapped.slice(0, 50));
