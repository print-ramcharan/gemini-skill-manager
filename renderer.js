// State
let allSkills = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedActiveIds = new Set();
let originalActiveIds = new Set();
let collapsedCategories = new Set(); // Track collapsed categories by name

// Elements
const skillsGrid = document.getElementById('skills-grid');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');
const activeCountEl = document.getElementById('active-count');
const backupCountEl = document.getElementById('backup-count');
const tokenBudgetValue = document.getElementById('token-budget-value');
const tokenBudgetBar = document.getElementById('token-budget-bar');
const tokenBudgetStatus = document.getElementById('token-budget-status');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');
const expandAllBtn = document.getElementById('expand-all-btn');
const limitToggle = document.getElementById('limit-toggle');
const applyBtn = document.getElementById('apply-btn');
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

// Fetch and render initial skills
async function init() {
  showLoading();
  try {
    allSkills = await window.api.getSkills();
    
    // Set initial sets
    selectedActiveIds.clear();
    originalActiveIds.clear();
    
    allSkills.forEach(skill => {
      if (skill.status === 'active') {
        selectedActiveIds.add(skill.id);
        originalActiveIds.add(skill.id);
      }
    });

    // Collapse large categories by default on first load
    collapsedCategories.clear();
    const categoriesCount = {};
    allSkills.forEach(skill => {
      const cat = getCategory(skill.id);
      categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
    });
    Object.keys(categoriesCount).forEach(cat => {
      if (categoriesCount[cat] > 20) {
        collapsedCategories.add(cat);
      }
    });

    updateStats();
    renderSkills();
    updateFooterState();
  } catch (err) {
    console.error('Failed to load skills:', err);
    skillsGrid.innerHTML = `<div class="loading-state"><p style="color: #ff5252;">Failed to load skills. Please check if directories exist.</p></div>`;
  }
}

function showLoading() {
  skillsGrid.innerHTML = `
    <div class="loading-state" id="loading-state">
      <div class="spinner"></div>
      <p>Scanning skills...</p>
    </div>
  `;
}

function updateStats() {
  const activeCount = selectedActiveIds.size;
  const backupCount = allSkills.length - activeCount;
  
  activeCountEl.textContent = activeCount;
  backupCountEl.textContent = backupCount;

  // Calculate token budget
  let totalTokens = 0;
  allSkills.forEach(skill => {
    if (selectedActiveIds.has(skill.id)) {
      totalTokens += skill.tokens || 500;
    }
  });

  // Render token budget
  const formattedTokens = totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens;
  tokenBudgetValue.textContent = formattedTokens;
  
  // Safety limit: 20,000 tokens (actual Claude Code customization budget)
  const safetyLimit = 20000;
  const percentOfLimit = Math.min((totalTokens / safetyLimit) * 100, 100);
  tokenBudgetBar.style.width = `${percentOfLimit}%`;

  // Dynamic gauge coloring
  if (totalTokens > safetyLimit) {
    tokenBudgetBar.style.backgroundColor = '#ff5252';
    tokenBudgetStatus.textContent = 'Token limit exceeded (Truncation!)';
    tokenBudgetStatus.style.color = '#ff5252';
  } else if (totalTokens > safetyLimit * 0.75) {
    tokenBudgetBar.style.backgroundColor = '#ffab40';
    tokenBudgetStatus.textContent = 'Approaching limit (Caution)';
    tokenBudgetStatus.style.color = '#ffab40';
  } else {
    tokenBudgetBar.style.backgroundColor = 'var(--success-color)';
    tokenBudgetStatus.textContent = 'Within safety limit (20k)';
    tokenBudgetStatus.style.color = 'var(--success-color)';
  }
}

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

function renderSkills() {
  const filtered = allSkills.filter(skill => {
    // 1. Filter by Status
    const isActive = selectedActiveIds.has(skill.id);
    if (currentFilter === 'active' && !isActive) return false;
    if (currentFilter === 'backup' && isActive) return false;

    // 2. Filter by Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = skill.name.toLowerCase().includes(q) || skill.id.toLowerCase().includes(q);
      const matchDesc = skill.description.toLowerCase().includes(q);
      return matchName || matchDesc;
    }

    return true;
  });

  if (filtered.length === 0) {
    skillsGrid.innerHTML = `
      <div class="loading-state">
        <p>No skills match your filters.</p>
      </div>
    `;
    return;
  }

  // Group by category
  const groups = {};
  filtered.forEach(skill => {
    const cat = getCategory(skill.id);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(skill);
  });

  skillsGrid.innerHTML = '';
  
  // Sort category keys to show General first or just alphabetical
  const categories = Object.keys(groups).sort((a, b) => {
    if (a === 'General Development Tools') return 1;
    if (b === 'General Development Tools') return -1;
    return a.localeCompare(b);
  });

  categories.forEach(catName => {
    const isCollapsed = collapsedCategories.has(catName);
    const section = document.createElement('div');
    section.className = `category-section ${isCollapsed ? 'collapsed' : ''}`;
    
    const groupSkills = groups[catName];
    const activeInGroup = groupSkills.filter(s => selectedActiveIds.has(s.id)).length;
    
    // Add Category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <div class="category-title-wrap">
        <span class="chevron">${isCollapsed ? '▶' : '▼'}</span>
        <h2>${catName} <span class="category-count">(${activeInGroup}/${groupSkills.length} active)</span></h2>
      </div>
      <div class="category-actions">
        <button class="text-btn select-group-btn" data-category="${catName}">Select All</button>
        <span class="divider">|</span>
        <button class="text-btn deselect-group-btn" data-category="${catName}">Deselect All</button>
      </div>
    `;
    
    // Click title to toggle collapse
    header.querySelector('.category-title-wrap').addEventListener('click', (e) => {
      if (collapsedCategories.has(catName)) {
        collapsedCategories.delete(catName);
      } else {
        collapsedCategories.add(catName);
      }
      renderSkills();
    });

    section.appendChild(header);
    
    if (!isCollapsed) {
      const cardGrid = document.createElement('div');
      cardGrid.className = 'category-grid';
      
      groupSkills.forEach(skill => {
        const isActive = selectedActiveIds.has(skill.id);
        const card = document.createElement('div');
        card.className = `skill-card ${isActive ? 'active' : ''}`;
        card.innerHTML = `
          <div class="skill-header">
            <span class="skill-name">${skill.name}</span>
            <label class="switch">
              <input type="checkbox" ${isActive ? 'checked' : ''} data-id="${skill.id}">
              <span class="slider"></span>
            </label>
          </div>
          <p class="skill-desc">${skill.description}</p>
          <div class="card-footer">
            <div class="badge-row">
              <span class="badge ${isActive ? 'active' : 'backup'}">${isActive ? 'Active' : 'Backup'}</span>
              <span class="badge token-badge">~${(skill.tokens/1000).toFixed(1)}k tokens</span>
            </div>
            <button class="text-btn view-doc-btn" data-id="${skill.id}" data-status="${isActive ? 'active' : 'backup'}">View Doc</button>
          </div>
        `;

        const checkbox = card.querySelector('input');
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleSkill(skill.id, e.target.checked);
        });

        const viewDocBtn = card.querySelector('.view-doc-btn');
        viewDocBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showSkillDoc(skill.id, isActive ? 'active' : 'backup');
        });

        card.addEventListener('click', () => {
          const newCheckedState = !checkbox.checked;
          checkbox.checked = newCheckedState;
          toggleSkill(skill.id, newCheckedState);
        });

        cardGrid.appendChild(card);
      });
      
      section.appendChild(cardGrid);
    }
    
    skillsGrid.appendChild(section);
  });

  // Wire up category action buttons (only active for visible categories to avoid errors)
  document.querySelectorAll('.select-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = btn.dataset.category;
      groups[cat].forEach(s => selectedActiveIds.add(s.id));
      updateStats();
      renderSkills();
      updateFooterState();
    });
  });

  document.querySelectorAll('.deselect-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = btn.dataset.category;
      groups[cat].forEach(s => selectedActiveIds.delete(s.id));
      updateStats();
      renderSkills();
      updateFooterState();
    });
  });
}

function toggleSkill(id, forceState) {
  if (forceState) {
    selectedActiveIds.add(id);
  } else {
    selectedActiveIds.delete(id);
  }
  updateStats();
  
  // Re-badge only the corresponding cards if visible to prevent layout shift
  renderSkills();
  updateFooterState();
}

function updateFooterState() {
  // Calculate differences
  let changes = 0;
  
  // Checking added items
  selectedActiveIds.forEach(id => {
    if (!originalActiveIds.has(id)) changes++;
  });
  // Checking removed items
  originalActiveIds.forEach(id => {
    if (!selectedActiveIds.has(id)) changes++;
  });

  if (changes > 0) {
    applyBtn.disabled = false;
    changesBadge.textContent = `${changes} skill${changes > 1 ? 's' : ''} to move`;
    changesBadge.style.color = 'var(--success-color)';
  } else {
    applyBtn.disabled = true;
    changesBadge.textContent = 'No changes pending';
    changesBadge.style.color = 'var(--text-secondary)';
  }
}

// Search filter
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderSkills();
});

// Category filter tabs
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
  allSkills.forEach(s => {
    collapsedCategories.add(getCategory(s.id));
  });
  renderSkills();
});

expandAllBtn.addEventListener('click', () => {
  collapsedCategories.clear();
  renderSkills();
});

// Progress updates from main process
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
  
  // Show progress modal
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  progressCount.textContent = `0 / 0`;
  progressStatus.textContent = 'Analyzing changes...';
  progressOverlay.classList.add('show');

  try {
    const result = await window.api.applyChanges(activeIdsArray);
    if (result.success) {
      // Reload skill directories state
      await init();
    }
  } catch (err) {
    console.error('Failed to apply changes:', err);
    alert('An error occurred during file operations.');
  } finally {
    progressOverlay.classList.remove('show');
  }
});

// Markdown parser helper for the doc viewer modal
function parseMarkdown(text) {
  let html = text
    // Clean yaml frontmatter if present
    .replace(/^---[\s\S]*?---/, '')
    // Headers
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    // Code blocks
    .replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bullet lists
    .replace(/^\s*-\s*(.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/^\s*\*\s*(.*$)/gim, '<ul><li>$1</li></ul>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Cleanup lists stacking
    .replace(/<\/ul>\s*<ul>/g, '');
  
  return html.split('\n').join('<br>');
}

// Load & show documentation details
async function showSkillDoc(skillId, status) {
  detailTitle.textContent = `Documentation: ${skillId}`;
  detailBody.innerHTML = '<div class="spinner" style="margin: 30px auto;"></div>';
  detailOverlay.classList.add('show');
  
  try {
    const markdown = await window.api.getSkillContent(skillId, status);
    detailBody.innerHTML = parseMarkdown(markdown);
  } catch (err) {
    detailBody.innerHTML = `<p style="color: #ff5252;">Failed to load documentation for ${skillId}.</p>`;
  }
}

closeDetailBtn.addEventListener('click', () => {
  detailOverlay.classList.remove('show');
});

// Quick Presets logic
const PRESETS = {
  fullstack: {
    categories: [
      'Backend Frameworks & Server APIs',
      'Databases & Data Engineering',
      'Frontend & UI Frameworks',
      '3D Graphics, Animations & UI Design',
      'Andruia Consultant & Agent Ecosystem',
      'System Design & Coding Patterns',
      'Core Languages'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'react-best', 'nextjs-best', 'fastapi', 'prisma', 'postgres', 'drizzle-orm', 'tailwind', 'shadcn',
        'hono', 'zod-', 'typescript', 'nodejs', 'uv-package', 'antigravity-design', 'clean-code', 'pr-writer',
        'create-pr', 'create-branch', 'monorepo-architect'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  mobile: {
    categories: [
      'Mobile App Development (Apple & Android)',
      'Frontend & UI Frameworks',
      '3D Graphics, Animations & UI Design',
      'Desktop App Development',
      'Andruia Consultant & Agent Ecosystem',
      'System Design & Coding Patterns',
      'Core Languages'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'react-native', 'swiftui', 'robius-app', 'android-cli', 'xcode-project', 'typescript', 'javascript',
        'swift', 'kotlin', 'brand-guidelines', 'design-spells', 'design-md', 'antigravity-design', 'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'desktop-dev': {
    categories: [
      'Desktop App Development',
      'Frontend & UI Frameworks',
      '3D Graphics, Animations & UI Design',
      'Andruia Consultant & Agent Ecosystem',
      'System Design & Coding Patterns',
      'Core Languages'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'electron', 'avalonia', 'macos-', 'makepad', 'rust', 'typescript', 'javascript', 'dotnet', 'cpp', 'swift',
        'antigravity-design', 'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'game-dev': {
    categories: [
      'Game Dev & 3D Shaders',
      '3D Graphics, Animations & UI Design',
      'Andruia Consultant & Agent Ecosystem',
      'System Design & Coding Patterns',
      'Core Languages'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'bevy', 'godot', 'game-', 'minecraft', 'unreal', 'unity', 'threejs', 'spline', 'glsl', 'shader',
        'rust', 'cpp', 'antigravity-design', 'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'web3-dev': {
    categories: [
      'Web3, Blockchain & Crypto',
      'Backend Frameworks & Server APIs',
      'Databases & Data Engineering',
      'Andruia Consultant & Agent Ecosystem',
      'System Design & Coding Patterns',
      'Core Languages'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'solidity', 'smart-contract', 'web3', 'ethereum', 'crypto', 'defi', 'bitcoin', 'blockchain', 'lightning',
        'rust', 'golang', 'typescript', 'postgres', 'sqlite', 'saas', 'billing', 'stripe', 'antigravity-design',
        'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'ai-ml': {
    categories: [
      'AI Models, Frameworks & RAG',
      'AI Personas & Philosophies',
      'Databases & Data Engineering',
      'Core Languages',
      'System Design & Coding Patterns',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'gemini-api', 'openai', 'claude-', 'rag-', 'vector-index', 'langchain', 'prompt-engineering',
        'transformers', 'pandas', 'numpy', 'python', 'antigravity-design', 'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  devops: {
    categories: [
      'AWS & DevOps Cloud',
      'Git, PR & Version Control',
      'Workflow Automation & Scripting',
      'Security & Vulnerability Auditing',
      'System Design & Coding Patterns',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'aws', 'terraform', 'docker', 'kubernetes', 'ci-cd', 'github', 'gitlab', 'secrets', 'bash-scripting',
        'powershell', 'antigravity-design', 'clean-code', 'pr-writer', 'git-'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  science: {
    categories: [
      'Science, Bio & Medicine',
      'Databases & Data Engineering',
      'Core Languages',
      'AI Personas & Philosophies',
      'AI Models, Frameworks & RAG',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'literature-search', 'clinical-trials', 'chembl', 'pubmed', 'alphafold', 'biopython', 'reactome', 'uniprot',
        'python', 'pandas', 'numpy', 'antigravity-design', 'clean-code'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'security-auditor': {
    categories: [
      'Security & Vulnerability Auditing',
      'Systems & Hardware Programming',
      'Core Languages',
      'System Design & Coding Patterns',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'pentest', 'security', 'red-team', 'malware', 'burp', 'vulnerability', 'attack', 'ethical-hacking',
        'sast', 'sec-', 'idor', 'shodan', 'fuzzing', 'reverse-engineer', 'sqlmap', 'metasploit', 'xss',
        'rust', 'cpp', 'python', 'antigravity-design', 'clean-code', 'pr-writer'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'cro-business': {
    categories: [
      'Business Strategy & CRO Optimization',
      'SEO, Marketing & Social Media',
      'Productivity & Collaboration Software',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'cro', 'pricing', 'startup', 'business', 'monetization', 'revops', 'billing', 'seo', 'marketing',
        'ads', 'copywriting', 'analytics', 'landing-page', 'amplitude', 'posthog', 'jira', 'asana', 'trello',
        'antigravity-design', 'clean-code'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  'automation-eng': {
    categories: [
      'Workflow Automation & Scripting',
      'Chatbots & Chat Integrations',
      'Productivity & Collaboration Software',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill, cat) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'automation', 'workflow', 'zapier', 'trigger', 'make-', 'bash', 'scripting', 'ssh', 'tmux', 'cron',
        'n8n', 'slack', 'telegram', 'discord', 'teams', 'twilio', 'antigravity-design', 'clean-code'
      ];
      return matches.some(m => id.includes(m));
    }
  },
  minimalist: {
    categories: [
      'System Design & Coding Patterns',
      'Git, PR & Version Control',
      'Andruia Consultant & Agent Ecosystem'
    ],
    filterSkill: (skill) => {
      const id = skill.id.toLowerCase();
      const matches = [
        'antigravity-design', 'clean-code', 'pr-writer', 'create-pr', 'git-'
      ];
      return matches.some(m => id.includes(m));
    }
  }
};

function applyPreset(presetName) {
  const rule = PRESETS[presetName];
  if (!rule) return;
  
  const enforceLimit = limitToggle.checked;
  
  // Apply selected skills matching this preset profile
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
    
    // Toggle active state styling
    const wasActive = btn.classList.contains('active');
    document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    
    if (wasActive) {
      // If clicked again, clear presets (reverts user to custom selection)
      return;
    }
    
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
