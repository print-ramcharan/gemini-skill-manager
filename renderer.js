// State
let allSkills = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedActiveIds = new Set();
let originalActiveIds = new Set();
let collapsedCategories = new Set();
let currentView = 'dashboard';
let defaultCategoryState = 'collapsed';

// Elements
const skillsGrid = document.getElementById('skills-grid');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');
const activeCountEl = document.getElementById('active-count');
const backupCountEl = document.getElementById('backup-count');
const tokenBudgetValue = document.getElementById('token-budget-value');
const tokenBudgetBar = document.getElementById('token-budget-bar');
const tokenBudgetStatus = document.getElementById('token-budget-status');
const modelSelect = document.getElementById('model-select');
const promptInput = document.getElementById('prompt-input');
const promptTokenCountEl = document.getElementById('prompt-token-count');
const modelWindowDisplay = document.getElementById('model-window-display');

// Token worker
let tokenWorker = null;
let lastActiveTokenCount = 0;
try {
  tokenWorker = new Worker('tokenWorker.js');
} catch (err) {
  console.warn('Token worker unavailable, falling back to estimator', err);
  tokenWorker = null;
}

const pendingWorkerRequests = new Map();
if (tokenWorker) {
  tokenWorker.addEventListener('message', (e) => {
    const { id, count } = e.data || {};
    const cb = pendingWorkerRequests.get(id);
    if (cb) {
      pendingWorkerRequests.delete(id);
      try { cb(count); } catch (err) { console.error(err); }
    }
  });
}

// Batching support: accumulate many skill requests and send one 'batch' message
const skillBatchQueue = [];
let skillBatchTimer = null;
function scheduleFlushSkillBatch(delay = 40) {
  if (skillBatchTimer) return;
  skillBatchTimer = setTimeout(() => {
    skillBatchTimer = null;
    flushSkillBatch();
  }, delay);
}

function flushSkillBatch() {
  if (!tokenWorker) {
    // fallback: resolve individually
    while (skillBatchQueue.length) {
      const item = skillBatchQueue.shift();
      const est = estimateTokens(item.text);
      const cb = pendingWorkerRequests.get(item.reqId);
      if (cb) { pendingWorkerRequests.delete(item.reqId); try { cb(est); } catch (e) {} }
    }
    return;
  }

  if (skillBatchQueue.length === 0) return;
  const items = skillBatchQueue.splice(0, skillBatchQueue.length).map(it => ({ id: it.reqId, text: it.text, model: it.model }));
  try {
    tokenWorker.postMessage({ type: 'batch', items });
  } catch (e) {
    // if batch fails, fall back to sending individually
    for (const it of items) {
      tokenWorker.postMessage({ type: 'count', id: it.id, text: it.text, model: it.model });
    }
  }
}

// Per-skill token cache and helpers
const skillTokenCache = new Map();

function skillHash(skill) {
  return `${skill.id}::${(skill.name||'')}::${(skill.description||'')}`;
}

function requestSkillToken(skill) {
  const cache = skillTokenCache.get(skill.id);
  const hash = skillHash(skill);
  if (cache && cache.hash === hash) {
    skill.tokens = cache.count;
    updateSkillTokenBadge(skill.id, cache.count);
    return Promise.resolve(cache.count);
  }

  return new Promise((resolve) => {
    const reqId = `skill-${skill.id}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const model = modelSelect ? modelSelect.value : null;
    const text = `${skill.id}\n${skill.name}\n${skill.description||''}`;
    const cb = (count) => {
      skill.tokens = count;
      skillTokenCache.set(skill.id, { hash, count, ts: Date.now() });
      updateSkillTokenBadge(skill.id, count);
      resolve(count);
    };

    pendingWorkerRequests.set(reqId, cb);
    // enqueue for batch flush
    skillBatchQueue.push({ reqId, text, model });
    scheduleFlushSkillBatch();
  });
}

function updateSkillTokenBadge(skillId, count) {
  const el = document.querySelector(`[data-token-badge="${skillId}"]`);
  if (el) {
    const formatted = count > 1000 ? `${(count/1000).toFixed(1)}k` : count;
    el.textContent = `~${formatted}`;
  }
}
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');
const expandAllBtn = document.getElementById('expand-all-btn');
const limitToggle = document.getElementById('limit-toggle');
const applyBtn = document.getElementById('apply-btn');
const discardBtn = document.getElementById('discard-btn');
const changesBadge = document.getElementById('changes-badge');
const progressOverlay = document.getElementById('progress-overlay');
const progressStatus = document.getElementById('progress-status');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const progressCount = document.getElementById('progress-count');

// Details Modal Elements
const detailOverlay = document.getElementById('detail-overlay');
const detailTitle = document.getElementById('detail-title');
const detailBody = document.getElementById('detail-body');
const closeDetailBtn = document.getElementById('close-detail-btn');

// Explore Elements
const exploreSearch = document.getElementById('explore-search');
const exploreGrid = document.getElementById('explore-grid');

// Settings Elements
const settingsLimitToggle = document.getElementById('settings-limit-toggle');
const defaultCategoryStateSelect = document.getElementById('default-category-state');

// ═══════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════
function switchView(viewName) {
  currentView = viewName;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (targetNav) targetNav.classList.add('active');

  // Update visible view
  document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
  const targetView = document.querySelector(`.view-content[data-view="${viewName}"]`);
  if (targetView) targetView.classList.add('active');

  // Show/hide footer based on view
  const footer = document.getElementById('action-footer');
  if (viewName === 'dashboard' || viewName === 'explore') {
    footer.style.display = 'flex';
  } else {
    footer.style.display = 'none';
  }

  // Render explore view content when switching to it
  if (viewName === 'explore') {
    renderExplore();
  }
}

// Wire up sidebar nav clicks
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(item.dataset.view);
  });
});

// ═══════════════════════════════
// INIT
// ═══════════════════════════════
async function init() {
  showLoading();
  try {
    allSkills = await window.api.getSkills();

    selectedActiveIds.clear();
    originalActiveIds.clear();

    allSkills.forEach(skill => {
      if (skill.status === 'active') {
        selectedActiveIds.add(skill.id);
        originalActiveIds.add(skill.id);
      }
    });

    // Default category state
    collapsedCategories.clear();
    if (defaultCategoryState === 'collapsed') {
      const allCats = new Set();
      allSkills.forEach(skill => allCats.add(getCategory(skill.id)));
      allCats.forEach(cat => collapsedCategories.add(cat));
    }

    updateStats();
    renderSkills();
    updateFooterState();
  } catch (err) {
    console.error('Failed to load skills:', err);
    skillsGrid.innerHTML = `<div class="loading-state"><p style="color: var(--danger-color);">Failed to load skills. Please check if directories exist.</p></div>`;
  }
}

function showLoading() {
  skillsGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Scanning skills...</p>
    </div>
  `;
}

// ═══════════════════════════════
// STATS
// ═══════════════════════════════
function updateStats() {
  const activeCount = selectedActiveIds.size;
  const backupCount = allSkills.length - activeCount;

  activeCountEl.textContent = activeCount;
  backupCountEl.textContent = backupCount;

  // compute active skills text and ask worker to estimate tokens
  const activeSkills = allSkills.filter(s => selectedActiveIds.has(s.id));
  const concatText = activeSkills.map(s => `${s.id}\n${s.name}\n${s.description || ''}`).join('\n\n');

  const requestId = `active-${Date.now()}-${Math.random()}`;
  const model = modelSelect ? modelSelect.value : null;

  const updateFromWorker = (count) => {
    lastActiveTokenCount = count;
    const formattedTokens = count > 1000 ? `${(count / 1000).toFixed(1)}k` : count;
    tokenBudgetValue.textContent = formattedTokens;

    const safetyLimit = getSafetyLimitForModel(model);
    const percentOfLimit = Math.min((count / safetyLimit) * 100, 100);
    tokenBudgetBar.style.width = `${percentOfLimit}%`;

    if (count > safetyLimit) {
      tokenBudgetBar.style.backgroundColor = '#FF3B30';
      tokenBudgetStatus.textContent = 'Token limit exceeded (Truncation!)';
      tokenBudgetStatus.style.color = '#FF3B30';
    } else if (count > safetyLimit * 0.75) {
      tokenBudgetBar.style.backgroundColor = '#FF9500';
      tokenBudgetStatus.textContent = 'Approaching limit (Caution)';
      tokenBudgetStatus.style.color = '#FF9500';
    } else {
      tokenBudgetBar.style.backgroundColor = 'var(--success-color)';
      tokenBudgetStatus.textContent = `Within safety limit (${formatNumber(safetyLimit)})`;
      tokenBudgetStatus.style.color = 'var(--success-color)';
    }
  };

  if (tokenWorker) {
    pendingWorkerRequests.set(requestId, updateFromWorker);
    tokenWorker.postMessage({ type: 'count', id: requestId, text: concatText, model });
  } else {
    // fallback estimation
    const fallback = estimateTokens(concatText);
    updateFromWorker(fallback);
  }
}

// Debounced updateStats wrapper to avoid flooding the worker
let statsDebounce = null;
function scheduleUpdateStats() {
  clearTimeout(statsDebounce);
  statsDebounce = setTimeout(updateStats, 120);
}

function formatNumber(n) {
  return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
}

function getSafetyLimitForModel(model) {
  const mapping = {
    'gpt-4o-mini-16k': 16000,
    'gpt-4o-mini-32k': 32768,
    'gpt-4-turbo': 131072,
    'gpt-3.5-turbo': 4096,
    'claude-2': 100000
  };
  return mapping[model] || 20000;
}

// Update model window display when selection changes
if (modelSelect) {
  // restore previous selection
  const saved = localStorage.getItem('gsm_selected_model');
  if (saved) modelSelect.value = saved;

  modelSelect.addEventListener('change', () => {
    localStorage.setItem('gsm_selected_model', modelSelect.value);
    modelWindowDisplay.textContent = formatNumber(getSafetyLimitForModel(modelSelect.value));
    updateStats();
    // when model changes, clear skill cache so tokens are recomputed for new model
    skillTokenCache.clear();
    allSkills.forEach(s => { delete s.tokens; });
    renderSkills();
  });
  // initialize
  modelWindowDisplay.textContent = formatNumber(getSafetyLimitForModel(modelSelect.value));
}

// Simple, fast token estimator (approximation):
function estimateTokens(text) {
  if (!text) return 0;
  // approximate: tokens ~= words * 1.33, fallback to bytes/4
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const byWords = Math.ceil(words * 1.33);
  const byBytes = Math.ceil(new Blob([text]).size / 4);
  return Math.max(1, Math.min(byWords, byBytes));
}

// Debounced prompt token counting
let promptDebounce = null;
if (promptInput) {
  promptInput.addEventListener('input', (e) => {
    clearTimeout(promptDebounce);
    promptDebounce = setTimeout(() => {
      const count = estimateTokens(e.target.value);
      promptTokenCountEl.textContent = count;
      // show relation to model window
      const window = getSafetyLimitForModel(modelSelect ? modelSelect.value : null);
      modelWindowDisplay.textContent = formatNumber(window);
    }, 150);
  });
}

// ═══════════════════════════════
// CATEGORY MAPPING
// ═══════════════════════════════
const CATEGORY_MAP = [
  { name: 'Azure Cloud Services', prefix: ['azure'] },
  { name: 'Odoo & ERP Enterprise', prefix: ['odoo', 'salesforce', 'dynamics', 'sap', 'wrike', 'zendesk'] },
  { name: 'Science, Bio & Medicine', prefix: ['literature-search', 'clinical-trials', 'chembl', 'pubmed', 'uniprot', 'alphafold', 'protein', 'clinvar', 'gnomad', 'dbsnp', 'jaspar', 'biopython', 'science', 'reactome', 'quickgo', 'pubchem', 'ucsc', 'unibind', 'embl', 'fda-', 'scanpy', 'sympy', 'variant-analysis'] },
  { name: 'Legal, Patents & PT Auctions', prefix: ['leiloeiro', 'advogado', 'junta-leiloeiros', 'lex'] },
  { name: 'Functional Programming & Async', prefix: ['fp-', 'functional-programming'] },
  { name: 'Workflow Automation & Scripting', prefix: ['automation', 'workflow', 'zapier', 'trigger', 'make-', 'bash', 'scripting', 'ssh', 'tmux', 'cron', 'n8n', 'twilio', 'web-scraper', 'firecrawl-scraper'] },
  { name: 'AWS & DevOps Cloud', prefix: ['aws', 'cdk', 'terraform', 'kubernetes', 'k8s', 'helm', 'docker', 'gcp', 'cloudflare', 'gitlab', 'github', 'secrets', 'deployment', 'gitops', 'ci-cd', 'jenkins', 'observability', 'prometheus', 'grafana', 'datadog', 'render-', 'devcontainer', 'cloud-architect', 'cloud-devops', 'cloudformation', 'service-mesh', 'network-101', 'network-engineer', 'mtls-', 'slo-implementation', 'appdeploy', 'server-management', 'build', 'devops', 'setup-guide', 'cloud', 'networking'] },
  { name: 'Mobile App Development (Apple & Android)', prefix: ['android', 'ios', 'swift', 'kotlin', 'flutter', 'mobile', 'xcode', 'swiftui', 'expo-', 'robius', 'upgrading-expo', 'app-store', 'multi-platform'] },
  { name: 'AI Models, Frameworks & RAG', prefix: ['ai-', 'ml-', 'machine-learning', 'numpy', 'pandas', 'scikit', 'matplotlib', 'astropy', 'cirq', 'qiskit', 'hugging', 'fal-', 'transformers', 'gemini-api', 'openai', 'claude-', 'rag-', 'tavily', 'stability', 'earllm', 'voice-', 'videodb', 'comfyui', 'agent', 'copilot', 'llm-', 'llm-app', 'prompt', 'langfuse', 'langgraph', 'vector-', 'mcp-', 'embedded-strategies', 'deep-research', 'crewai', 'subagent', 'computer-use', 'computer-vision', 'audio-transcriber', 'imagen', 'jobgpt', 'podcast-', 'seek-and-analyze', 'task-intelligence', 'youtube-summarizer', 'advanced-evaluation', 'context-', 'context7', 'conversation-memory', 'embedding-', 'search', 'bdi-mental', 'bdistill', 'adhx', 'tool-use', '-ai', 'mlops', 'advisor'] },
  { name: 'AI Personas & Philosophies', prefix: ['sam-altman', 'yann-lecun', 'elon-musk', 'steve-jobs', 'bill-gates', 'geoffrey-hinton', 'warren-buffett', 'nerdzao', 'moyu', 'viboscope', 'explain-like-socrates', 'karpathy', 'ilya-sutskever', 'matematico-tao', '007'] },
  { name: 'Backend Frameworks & Server APIs', prefix: ['fastapi', 'django', 'hono', 'graphql', 'trpc', 'rest', 'api-', 'pydantic', 'nodejs', 'express', 'nestjs', 'backend', 'saas', 'billing', 'stripe', 'paypal', 'payment', 'zustand', 'supabase', 'socket', 'websockets', 'laravel', 'zod-', 'clerk-auth', 'bullmq', 'algolia-search', 'inngest', 'plaid-fintech', 'upstash-', 'firebase'] },
  { name: 'Databases & Data Engineering', prefix: ['database', 'sql', 'postgres', 'prisma', 'mongodb', 'nosql', 'redis', 'convex', 'neon-', 'snowflake', 'clickhouse', 'dbt', 'spark', 'polars', 'airflow', 'kafka', 'data-engineering', 'data-quality', 'data-scientist', 'postgresql', 'drizzle-orm', 'geo-fundamentals', 'plotly', 'seaborn', 'statsmodels', 'networkx', 'using-neon', 'data-'] },
  { name: 'Core Languages', prefix: ['python', 'golang', 'go-', 'rust', 'cpp', 'c-pro', 'csharp', 'java', 'ruby', 'rails', 'php', 'haskell', 'julia', 'typescript', 'javascript', 'dotnet', 'scala', 'elixir', 'uv-package-manager'] },
  { name: '3D Graphics, Animations & UI Design', prefix: ['threejs', 'spline', 'glsl', 'shader', 'canvas', 'animejs', 'remotion', 'popmotion', 'scroll-experience', 'vizcom', 'algorithmic-art', 'image-studio', 'brand-guidelines', 'design-spells', 'design-md', 'ui-skills', 'ui-ux', 'hig-', 'radix', 'shadcn', 'tailwind', 'layout', 'components', 'theme-', 'css', 'html', 'visual', 'a11y', 'accessibility', 'web-design', '3d-web', 'baseline-ui', 'favicon', 'iconsax', 'kpi-dashboard', 'mermaid-expert', 'stitch-loop', 'stitch-ui', 'theme-factory', 'design-'] },
  { name: 'Web3, Blockchain & Crypto', prefix: ['nft', 'solidity', 'smart-contract', 'web3', 'ethereum', 'crypto', 'defi', 'bitcoin', 'lightning-', 'solidity-security', 'blockchain-developer', 'blockrun'] },
  { name: 'Chatbots & Chat Integrations', prefix: ['telegram', 'slack', 'whatsapp', 'discord', 'teams', 'zoom', 'microsoft-teams', 'chat-widget'] },
  { name: 'Personal Knowledge Base & Wikis', prefix: ['obsidian', 'wiki-', 'diary', 'agent-memory', 'notion', 'notebooklm', 'documentation', 'readme', 'docs', 'blog-writing', 'beautiful-prose', 'copy-editing', 'latex-paper', 'professional-proofreader', 'tutorial-engineer', 'writing-plans', 'writing-skills', 'yes-md', 'reference-builder', 'plan-', 'planning', 'citation-', 'emergency-card', 'fixing-metadata', 'infinite-gratitude', 'last30days', 'loki-mode', 'postmortem-', 'brainstorming'] },
  { name: 'Productivity & Collaboration Software', prefix: ['product-manager', 'office', 'ppt', 'pdf', 'excel', 'word', 'docx', 'xlsx', 'pptx', 'hubspot', 'jira', 'asana', 'trello', 'brevo', 'outlook', 'gmail', 'google-', 'confluence', 'wrike', 'monday-', 'daily', 'onboarding', 'interview-coach', 'linear', 'progressive-estimation', 'team-collaboration', 'team-composition', 'track-management', 'personal-tool-builder', 'screenshots', 'executing-plans', 'internal-comms'] },
  { name: 'SEO, Marketing & Social Media', prefix: ['seo', 'marketing', 'apify', 'lead', 'social', 'growth', 'paid-ads', 'email', 'copywriting', 'ads', 'landing-page', 'analytics', 'amplitude', 'posthog', 'mixpanel', 'referral', 'viral', 'ad-creative', 'content-creator', 'content-strategy', 'instagram', 'linkedin-cli', 'schema-markup', 'segment-cdp', 'x-article', 'x-twitter-scraper'] },
  { name: 'Security & Vulnerability Auditing', prefix: ['pentest', 'security', 'red-team', 'malware', 'burp', 'active-directory', 'vulnerability', 'attack', 'ethical-hacking', 'solidity-security', 'sast', 'sec-', 'idor', 'shodan', 'scanning', 'fuzzing', 'privilege', 'reverse-engineer', 'zeroize', 'sqlmap', 'metasploit', 'xss', 'anti-reversing', 'broken-authentication', 'pci-compliance', 'privacy-by-design', 'semgrep', 'threat-mitigation', 'threat-modeling', 'top-web-vulnerabilities', 'wireshark'] },
  { name: 'Systems & Hardware Programming', prefix: ['embedded', 'firmware', 'c-', 'cpp', 'assembly', 'arm', 'systems-programming', 'dwarf', 'gdb', 'binary', 'memory-', 'linux-shell', 'linux-troubleshooting', 'posix-shell', 'powershell', 'bash-linux', 'bash-pro', 'bash-scripting', 'os-scripting', 'busybox-on-windows', 'filesystem-context', 'file-organizer', 'file-path-traversal', 'pypict-skill', 'sharp-edges', 'tmux', 'varlock', 'vexor', 'windows-shell', 'jq', 'molykit'] },
  { name: 'Browser Extensions & Web Tools', prefix: ['chrome-extension', 'browser-extension', 'firefox'] },
  { name: 'System Design & Coding Patterns', prefix: ['architecture', 'c4-', 'patterns', 'ddd-', 'monorepo', 'nx-', 'refactor', 'cleanup', 'kaizen', 'simplifier', 'clean-code', 'analyze-project', 'architect-review', 'ask-questions-if-underspecified', 'auri-core', 'blueprint', 'clarity-gate', 'codebase-audit', 'codebase-cleanup', 'cqrs-', 'development', 'domain-driven-design', 'event-sourcing', 'event-store', 'evolution', 'framework-migration', 'legacy-modernizer', 'project-development', 'project-skill-audit', 'saga-orchestration', 'senior-architect', 'senior-fullstack', 'simplify-code', 'tool-design', 'turborepo-caching', 'uncle-bob', 'constant-time-analysis', 'event-store-design', 'audit-', 'spdd', 'full-stack-orchestration'] },
  { name: 'Git, PR & Version Control', prefix: ['git-', 'pr-writer', 'create-pr', 'create-branch', 'git-worktrees', 'review-requests', 'commit', 'gh-review-requests', 'git-pushing', 'iterate-pr'] },
  { name: 'Andruia Consultant & Agent Ecosystem', prefix: ['00-andruia', '10-andruia', '20-andruia', 'andruia', 'antigravity', 'maxia', 'skill-check', 'skill-creator', 'skill-developer', 'skill-improver', 'skill-installer', 'skill-router', 'skill-scanner', 'skill-seekers', 'skill-sentinel', 'skill-writer', 'superpowers-lab', 'using-superpowers'] },
  { name: 'Business Strategy & CRO Optimization', prefix: ['cro', 'pricing', 'startup', 'business', 'monetization', 'sred', 'competitor', 'market', 'revops', 'billing', 'carrier-relationship', 'churn-prevention', 'competitive-landscape', 'customs-trade', 'employment-contract', 'energy-procurement', 'free-tool', 'gdpr-data', 'hr-pro', 'inventory-demand', 'launch-strategy', 'legal-advisor', 'logistics-exception', 'quality-nonconformance', 'quant-analyst', 'recallmax', 'returns-reverse', 'risk-manager', 'risk-metrics', 'sales-automator', 'sales-enablement', 'supply-chain', 'xvary-stock', 'product-', 'custom-', 'closed-loop', 'cost-optimization', 'alpha-vantage', 'cred-omega', 'customer-support', 'production-scheduling'] },
  { name: 'Quality Assurance, Testing & Perf', prefix: ['testing', 'test-', 'tdd', '-test', 'e2e', 'playwright', 'cypress', 'bug', 'debug', 'error', 'perf', 'performance', 'diagnostics', 'validation', 'acceptance-orchestrator', 'clarvia-aeo-check', 'code-review', 'code-reviewer', 'codex-review', 'comprehensive-review', 'conductor-', 'defuddle', 'dependency-management', 'dependency-upgrade', 'differential-review', 'distributed-tracing', 'dx-optimizer', 'evaluation', 'incident-', 'issues', 'lint-and-validate', 'oss-hunter', 'production-code-audit', 'receiving-code-review', 'requesting-code-review', 'shellcheck-configuration', 'speckit-updater', 'speed', 'verification-before', 'vibe-code', 'vibers-code', 'fix-review', 'create-issue-gate'] },
  { name: 'Health, Wellness & Medicine', prefix: ['health', 'fitness', 'nutrition', 'wellness', '-analyzer', 'medical', 'clinical', 'oral', 'dental', 'sleep', 'rehabilitation', 'anatomy', 'physio', 'wellally-tech', 'stride-analysis'] },
  { name: 'Frontend & UI Frameworks', prefix: ['react', 'angular', 'nextjs', 'expo', 'shopify', 'wordpress', 'svelte', 'hono', 'vite', 'nextlevel', 'astro', 'vue', 'nuxt', 'remix', 'solidjs', 'lit-', 'progressive-web', 'tanstack-query', 'unsplash-integration', 'web-artifacts-builder', 'app-builder', 'frontend', 'building-native-ui', 'i18n-localization', 'interactive-', 'manifest', 'native-data-'] },
  { name: 'Game Dev & 3D Shaders', prefix: ['bevy', 'godot', 'game-', 'minecraft', 'unreal', 'unity', 'game-development'] },
  { name: 'Desktop App Development', prefix: ['electron-development', 'avalonia-layout-zafiro', 'avalonia-viewmodels-zafiro', 'avalonia-zafiro-development', 'macos-menubar', 'macos-spm', 'makepad'] }
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

// ═══════════════════════════════
// DASHBOARD: CATEGORY ROWS
// ═══════════════════════════════
function renderSkills() {
  const filtered = allSkills.filter(skill => {
    const isActive = selectedActiveIds.has(skill.id);
    if (currentFilter === 'active' && !isActive) return false;
    if (currentFilter === 'backup' && isActive) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return skill.name.toLowerCase().includes(q) || skill.id.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    skillsGrid.innerHTML = '<div class="loading-state"><p>No skills match your filters.</p></div>';
    return;
  }

  const groups = {};
  filtered.forEach(skill => {
    const cat = getCategory(skill.id);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(skill);
  });

  skillsGrid.innerHTML = '';

  const categories = Object.keys(groups).sort((a, b) => {
    if (a === 'General Development Tools') return 1;
    if (b === 'General Development Tools') return -1;
    return a.localeCompare(b);
  });

  categories.forEach(catName => {
    const isExpanded = !collapsedCategories.has(catName);
    const groupSkills = groups[catName];
    const activeInGroup = groupSkills.filter(s => selectedActiveIds.has(s.id)).length;
    const someActive = activeInGroup > 0;

    const row = document.createElement('div');
    row.className = `category-row ${isExpanded ? 'expanded' : ''}`;

    let bodyHtml = '';
    if (isExpanded) {
      const items = groupSkills.map(skill => {
        const isActive = selectedActiveIds.has(skill.id);
        const tokenDisplay = skill.tokens ? (skill.tokens > 1000 ? `${(skill.tokens/1000).toFixed(1)}k` : skill.tokens) : '0';
        return `
          <div class="sub-skill-item ${isActive ? 'active' : ''}" data-skill-id="${skill.id}" title="${skill.description}">
            <span class="sub-skill-name">${skill.name}</span>
            <span class="skill-token-badge" data-token-badge="${skill.id}">~${tokenDisplay}</span>
            <label class="switch small" onclick="event.stopPropagation()">
              <input type="checkbox" ${isActive ? 'checked' : ''} data-id="${skill.id}">
              <span class="slider round"></span>
            </label>
          </div>
        `;
      }).join('');
      bodyHtml = `<div class="category-row-body">${items}</div>`;
    }

    row.innerHTML = `
      <div class="category-row-header">
        <div class="category-row-left">
          <span class="category-name">${catName}</span>
          <span class="category-count-badge">${activeInGroup}/${groupSkills.length}</span>
        </div>
        <div class="category-row-right">
          <label class="switch" onclick="event.stopPropagation()">
            <input type="checkbox" class="category-toggle" data-category="${catName}" ${someActive ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="category-chevron">${isExpanded ? '▾' : '›'}</span>
        </div>
      </div>
      ${bodyHtml}
    `;

    // Expand/collapse
    row.querySelector('.category-row-header').addEventListener('click', () => {
      if (collapsedCategories.has(catName)) {
        collapsedCategories.delete(catName);
      } else {
        collapsedCategories.add(catName);
      }
      renderSkills();
    });

    // Category master toggle
    row.querySelector('.category-toggle').addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        groupSkills.forEach(s => selectedActiveIds.add(s.id));
      } else {
        groupSkills.forEach(s => selectedActiveIds.delete(s.id));
      }
      updateStats();
      renderSkills();
      updateFooterState();
    });

    // Individual skill toggles
    if (isExpanded) {
      row.querySelectorAll('.sub-skill-item input[data-id]').forEach(cb => {
        cb.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleSkill(e.target.dataset.id, e.target.checked);
        });
      });
      row.querySelectorAll('.sub-skill-item').forEach(item => {
        item.addEventListener('click', () => {
          const cb = item.querySelector('input');
          cb.checked = !cb.checked;
          toggleSkill(cb.dataset.id, cb.checked);
        });
      });
    }

    skillsGrid.appendChild(row);
    // request tokens for visible skills in expanded category
    if (isExpanded) {
      groupSkills.forEach(s => requestSkillToken(s).catch(() => {}));
    }
  });
}

// ═══════════════════════════════
// EXPLORE VIEW
// ═══════════════════════════════
function renderExplore() {
  const searchVal = (exploreSearch ? exploreSearch.value : '').toLowerCase();

  let skills = [...allSkills];
  if (searchVal) {
    skills = skills.filter(s =>
      s.name.toLowerCase().includes(searchVal) ||
      s.id.toLowerCase().includes(searchVal) ||
      s.description.toLowerCase().includes(searchVal) ||
      getCategory(s.id).toLowerCase().includes(searchVal)
    );
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));

  if (skills.length === 0) {
    exploreGrid.innerHTML = '<div class="explore-empty">No skills found.</div>';
    return;
  }

  exploreGrid.innerHTML = skills.map(skill => {
    const isActive = selectedActiveIds.has(skill.id);
    const cat = getCategory(skill.id);
    return `
      <div class="explore-row ${isActive ? 'active' : ''}" data-skill-id="${skill.id}">
        <div class="explore-row-left">
          <span class="explore-skill-name">${skill.name}</span>
          <span class="explore-skill-category">${cat}</span>
        </div>
        <div class="explore-row-right">
          <span class="explore-token-badge" data-token-badge="${skill.id}">~${((skill.tokens || 500) / 1000).toFixed(1)}k</span>
          <label class="switch small" onclick="event.stopPropagation()">
            <input type="checkbox" ${isActive ? 'checked' : ''} data-id="${skill.id}">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // request tokens for visible explore skills
  skills.forEach(s => requestSkillToken(s).catch(() => {}));

  // Wire up toggles
  exploreGrid.querySelectorAll('input[data-id]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleSkill(e.target.dataset.id, e.target.checked);
      renderExplore();
    });
  });

  // Click row to toggle
  exploreGrid.querySelectorAll('.explore-row').forEach(row => {
    row.addEventListener('click', () => {
      const cb = row.querySelector('input');
      cb.checked = !cb.checked;
      toggleSkill(cb.dataset.id, cb.checked);
      renderExplore();
    });
  });
}

if (exploreSearch) {
  exploreSearch.addEventListener('input', () => {
    renderExplore();
  });
}

// ═══════════════════════════════
// SETTINGS SYNC
// ═══════════════════════════════
if (settingsLimitToggle) {
  // Sync settings toggle with main limit toggle
  settingsLimitToggle.checked = limitToggle.checked;
  settingsLimitToggle.addEventListener('change', () => {
    limitToggle.checked = settingsLimitToggle.checked;
    limitToggle.dispatchEvent(new Event('change'));
  });
  limitToggle.addEventListener('change', () => {
    settingsLimitToggle.checked = limitToggle.checked;
  });
}

if (defaultCategoryStateSelect) {
  defaultCategoryStateSelect.addEventListener('change', () => {
    defaultCategoryState = defaultCategoryStateSelect.value;
  });
}

// ═══════════════════════════════
// SHARED LOGIC
// ═══════════════════════════════
function toggleSkill(id, forceState) {
  if (forceState) {
    selectedActiveIds.add(id);
  } else {
    selectedActiveIds.delete(id);
  }
  updateStats();
  renderSkills();
  updateFooterState();
}

function updateFooterState() {
  let changes = 0;
  selectedActiveIds.forEach(id => { if (!originalActiveIds.has(id)) changes++; });
  originalActiveIds.forEach(id => { if (!selectedActiveIds.has(id)) changes++; });

  if (changes > 0) {
    applyBtn.disabled = false;
    changesBadge.textContent = `${changes} skill${changes > 1 ? 's' : ''} to move`;
    changesBadge.style.color = 'var(--accent-color)';
  } else {
    applyBtn.disabled = true;
    changesBadge.textContent = 'No changes pending';
    changesBadge.style.color = 'var(--text-secondary)';
  }
}

// ═══════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════

// Search
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderSkills();
});

// Filter tabs
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderSkills();
  });
});

// Select / Deselect All
selectAllBtn.addEventListener('click', () => {
  allSkills.forEach(s => selectedActiveIds.add(s.id));
  updateStats();
  renderSkills();
  updateFooterState();
});

deselectAllBtn.addEventListener('click', () => {
  selectedActiveIds.clear();
  updateStats();
  renderSkills();
  updateFooterState();
});

// Collapse / Expand All
collapseAllBtn.addEventListener('click', () => {
  allSkills.forEach(s => collapsedCategories.add(getCategory(s.id)));
  renderSkills();
});

expandAllBtn.addEventListener('click', () => {
  collapsedCategories.clear();
  renderSkills();
});

// Progress updates
window.api.onProgress(({ current, total, skillName, target }) => {
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressCount.textContent = `${current} / ${total}`;
  progressStatus.textContent = `Moving "${skillName}" to ${target === 'active' ? 'Active' : 'Backup'}...`;
});

// Apply Changes
applyBtn.addEventListener('click', async () => {
  const activeIdsArray = Array.from(selectedActiveIds);

  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  progressCount.textContent = '0 / 0';
  progressStatus.textContent = 'Analyzing changes...';
  progressOverlay.classList.add('show');

  try {
    const result = await window.api.applyChanges(activeIdsArray);
    if (result.success) {
      await init();
    }
  } catch (err) {
    console.error('Failed to apply changes:', err);
    alert('An error occurred during file operations.');
  } finally {
    progressOverlay.classList.remove('show');
  }
});

// Discard Changes
if (discardBtn) {
  discardBtn.addEventListener('click', () => {
    selectedActiveIds = new Set(originalActiveIds);
    document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    updateStats();
    renderSkills();
    updateFooterState();
    if (currentView === 'explore') renderExplore();
  });
}

// Markdown parser
function parseMarkdown(text) {
  let html = text
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*-\s*(.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/^\s*\*\s*(.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/<\/ul>\s*<ul>/g, '');
  return html.split('\n').join('<br>');
}

// Doc viewer modal
async function showSkillDoc(skillId, status) {
  detailTitle.textContent = `Documentation: ${skillId}`;
  detailBody.innerHTML = '<div class="spinner" style="margin: 30px auto;"></div>';
  detailOverlay.classList.add('show');

  try {
    const markdown = await window.api.getSkillContent(skillId, status);
    detailBody.innerHTML = parseMarkdown(markdown);
  } catch (err) {
    detailBody.innerHTML = `<p style="color: var(--danger-color);">Failed to load documentation for ${skillId}.</p>`;
  }
}

closeDetailBtn.addEventListener('click', () => {
  detailOverlay.classList.remove('show');
});

// ═══════════════════════════════
// PRESETS
// ═══════════════════════════════
const PRESETS = {
  fullstack: {
    categories: ['Backend Frameworks & Server APIs', 'Databases & Data Engineering', 'Frontend & UI Frameworks', '3D Graphics, Animations & UI Design', 'Andruia Consultant & Agent Ecosystem', 'System Design & Coding Patterns', 'Core Languages'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['react-best', 'nextjs-best', 'fastapi', 'prisma', 'postgres', 'drizzle-orm', 'tailwind', 'shadcn', 'hono', 'zod-', 'typescript', 'nodejs', 'uv-package', 'antigravity-design', 'clean-code', 'pr-writer', 'create-pr', 'create-branch', 'monorepo-architect'].some(m => id.includes(m));
    }
  },
  mobile: {
    categories: ['Mobile App Development (Apple & Android)', 'Frontend & UI Frameworks', '3D Graphics, Animations & UI Design', 'Desktop App Development', 'Andruia Consultant & Agent Ecosystem', 'System Design & Coding Patterns', 'Core Languages'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['react-native', 'swiftui', 'robius-app', 'android-cli', 'xcode-project', 'typescript', 'javascript', 'swift', 'kotlin', 'brand-guidelines', 'design-spells', 'design-md', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  'desktop-dev': {
    categories: ['Desktop App Development', 'Frontend & UI Frameworks', '3D Graphics, Animations & UI Design', 'Andruia Consultant & Agent Ecosystem', 'System Design & Coding Patterns', 'Core Languages'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['electron', 'avalonia', 'macos-', 'makepad', 'rust', 'typescript', 'javascript', 'dotnet', 'cpp', 'swift', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  'game-dev': {
    categories: ['Game Dev & 3D Shaders', '3D Graphics, Animations & UI Design', 'Andruia Consultant & Agent Ecosystem', 'System Design & Coding Patterns', 'Core Languages'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['bevy', 'godot', 'game-', 'minecraft', 'unreal', 'unity', 'threejs', 'spline', 'glsl', 'shader', 'rust', 'cpp', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  'web3-dev': {
    categories: ['Web3, Blockchain & Crypto', 'Backend Frameworks & Server APIs', 'Databases & Data Engineering', 'Andruia Consultant & Agent Ecosystem', 'System Design & Coding Patterns', 'Core Languages'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['solidity', 'smart-contract', 'web3', 'ethereum', 'crypto', 'defi', 'bitcoin', 'blockchain', 'lightning', 'rust', 'golang', 'typescript', 'postgres', 'sqlite', 'saas', 'billing', 'stripe', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  'ai-ml': {
    categories: ['AI Models, Frameworks & RAG', 'AI Personas & Philosophies', 'Databases & Data Engineering', 'Core Languages', 'System Design & Coding Patterns', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['gemini-api', 'openai', 'claude-', 'rag-', 'vector-index', 'langchain', 'prompt-engineering', 'transformers', 'pandas', 'numpy', 'python', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  devops: {
    categories: ['AWS & DevOps Cloud', 'Git, PR & Version Control', 'Workflow Automation & Scripting', 'Security & Vulnerability Auditing', 'System Design & Coding Patterns', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['aws', 'terraform', 'docker', 'kubernetes', 'ci-cd', 'github', 'gitlab', 'secrets', 'bash-scripting', 'powershell', 'antigravity-design', 'clean-code', 'pr-writer', 'git-'].some(m => id.includes(m));
    }
  },
  science: {
    categories: ['Science, Bio & Medicine', 'Databases & Data Engineering', 'Core Languages', 'AI Personas & Philosophies', 'AI Models, Frameworks & RAG', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['literature-search', 'clinical-trials', 'chembl', 'pubmed', 'alphafold', 'biopython', 'reactome', 'uniprot', 'python', 'pandas', 'numpy', 'antigravity-design', 'clean-code'].some(m => id.includes(m));
    }
  },
  'security-auditor': {
    categories: ['Security & Vulnerability Auditing', 'Systems & Hardware Programming', 'Core Languages', 'System Design & Coding Patterns', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['pentest', 'security', 'red-team', 'malware', 'burp', 'vulnerability', 'attack', 'ethical-hacking', 'sast', 'sec-', 'idor', 'shodan', 'fuzzing', 'reverse-engineer', 'sqlmap', 'metasploit', 'xss', 'rust', 'cpp', 'python', 'antigravity-design', 'clean-code', 'pr-writer'].some(m => id.includes(m));
    }
  },
  'cro-business': {
    categories: ['Business Strategy & CRO Optimization', 'SEO, Marketing & Social Media', 'Productivity & Collaboration Software', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['cro', 'pricing', 'startup', 'business', 'monetization', 'revops', 'billing', 'seo', 'marketing', 'ads', 'copywriting', 'analytics', 'landing-page', 'amplitude', 'posthog', 'jira', 'asana', 'trello', 'antigravity-design', 'clean-code'].some(m => id.includes(m));
    }
  },
  'automation-eng': {
    categories: ['Workflow Automation & Scripting', 'Chatbots & Chat Integrations', 'Productivity & Collaboration Software', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['automation', 'workflow', 'zapier', 'trigger', 'make-', 'bash', 'scripting', 'ssh', 'tmux', 'cron', 'n8n', 'slack', 'telegram', 'discord', 'teams', 'twilio', 'antigravity-design', 'clean-code'].some(m => id.includes(m));
    }
  },
  minimalist: {
    categories: ['System Design & Coding Patterns', 'Git, PR & Version Control', 'Andruia Consultant & Agent Ecosystem'],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      return ['antigravity-design', 'clean-code', 'pr-writer', 'create-pr', 'git-'].some(m => id.includes(m));
    }
  }
};

function applyPreset(presetName) {
  const rule = PRESETS[presetName];
  if (!rule) return;

  const enforceLimit = limitToggle.checked;

  selectedActiveIds.clear();
  allSkills.forEach(skill => {
    const cat = getCategory(skill.id);
    if (rule.categories.includes(cat)) {
      if (!enforceLimit || rule.filterSkill(skill, cat)) {
        selectedActiveIds.add(skill.id);
      }
    }
  });

  updateStats();
  renderSkills();
  updateFooterState();
}

document.querySelectorAll('.preset-pill').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasActive = btn.classList.contains('active');
    document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    if (wasActive) return;
    btn.classList.add('active');
    applyPreset(btn.dataset.preset);
  });
});

limitToggle.addEventListener('change', () => {
  const activeBtn = document.querySelector('.preset-pill.active');
  if (activeBtn) {
    applyPreset(activeBtn.dataset.preset);
  }
});

// Start
init();
