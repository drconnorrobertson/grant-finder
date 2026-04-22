/* ========================================
   Grant Finder - Core Application Logic
   ======================================== */

// Utility functions
function formatCurrency(amount) {
  if (amount >= 1000000000) return '$' + (amount / 1000000000).toFixed(1) + 'B';
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + 'M';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
  return '$' + amount.toLocaleString();
}

function formatAmountRange(min, max) {
  if (min === max) return formatCurrency(min);
  return formatCurrency(min) + ' - ' + formatCurrency(max);
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'Rolling') return 'Rolling';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr || dateStr === 'Rolling') return Infinity;
  const now = new Date();
  const deadline = new Date(dateStr + 'T00:00:00');
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

function getCategoryBadgeClass(category) {
  const map = {
    'Education': 'badge-education',
    'Health': 'badge-health',
    'Arts & Culture': 'badge-arts',
    'Environment': 'badge-environment',
    'Social Services': 'badge-social',
    'Technology': 'badge-technology',
    'Community Development': 'badge-community',
    'Youth Development': 'badge-youth',
    'Housing': 'badge-housing',
    'Research': 'badge-research'
  };
  return map[category] || 'badge-category';
}

function getCategoryIcon(category) {
  const icons = {
    'Education': '📚',
    'Health': '🏥',
    'Arts & Culture': '🎨',
    'Environment': '🌿',
    'Social Services': '🤝',
    'Technology': '💻',
    'Community Development': '🏘️',
    'Youth Development': '👦',
    'Housing': '🏠',
    'Research': '🔬'
  };
  return icons[category] || '📋';
}

function getCategoryColor(category) {
  const colors = {
    'Education': '#dbeafe',
    'Health': '#fce7f3',
    'Arts & Culture': '#ede9fe',
    'Environment': '#d1fae5',
    'Social Services': '#ffedd5',
    'Technology': '#e0f2fe',
    'Community Development': '#fef3c7',
    'Youth Development': '#fce7f3',
    'Housing': '#f3e8ff',
    'Research': '#ecfdf5'
  };
  return colors[category] || '#f1f5f9';
}

function getGrantCountByCategory(category) {
  return GRANTS_DATA.filter(g => g.category === category).length;
}

function getGrantCountByState(stateAbbr) {
  return GRANTS_DATA.filter(g => g.states.includes(stateAbbr) || g.states.includes('National')).length;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Generate a grant card HTML
function renderGrantCard(grant) {
  const days = daysUntil(grant.deadline);
  const deadlineClass = days < 30 ? 'urgent' : '';
  const deadlineText = grant.deadline === 'Rolling' ? 'Rolling Deadline' : formatDate(grant.deadline);
  const statesText = grant.states.includes('National') ? 'National' : grant.states.slice(0, 3).join(', ') + (grant.states.length > 3 ? '...' : '');

  return `
    <div class="card grant-card" data-id="${grant.id}">
      <div class="grant-card-header">
        <div>
          <div class="grant-card-title">
            <a href="/grants/?id=${grant.id}" onclick="showGrantDetail(${grant.id}); return false;">${grant.title}</a>
          </div>
          <div class="grant-card-funder">${grant.funder}</div>
        </div>
        <div class="grant-card-amount">${formatAmountRange(grant.amountMin, grant.amountMax)}</div>
      </div>
      <div class="grant-card-description">${grant.description}</div>
      <div class="grant-card-meta">
        <span class="badge ${getCategoryBadgeClass(grant.category)}">${grant.category}</span>
        <span class="badge badge-state">${statesText}</span>
        <span class="badge badge-deadline ${deadlineClass}">${deadlineText}</span>
        ${grant.featured ? '<span class="badge badge-featured">Featured</span>' : ''}
      </div>
      <div class="grant-card-footer">
        <a href="/grants/?id=${grant.id}" class="btn btn-sm btn-secondary" onclick="showGrantDetail(${grant.id}); return false;">View Details</a>
        <a href="${grant.applicationUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Apply Now</a>
      </div>
    </div>
  `;
}

// Grant detail modal
function showGrantDetail(grantId) {
  const grant = GRANTS_DATA.find(g => g.id === grantId);
  if (!grant) return;

  const days = daysUntil(grant.deadline);
  const deadlineText = grant.deadline === 'Rolling' ? 'Rolling' : formatDate(grant.deadline);
  const deadlineNote = days < 30 && days > 0 ? `<span style="color:#ef4444;font-size:0.85rem;"> (${days} days left!)</span>` : '';
  const statesText = grant.states.includes('National') ? 'All 50 states + DC' : grant.states.join(', ');

  const html = `
    <div class="modal-header">
      <div>
        <h2 style="font-size:1.5rem;margin-bottom:4px;">${grant.title}</h2>
        <div style="color:var(--gray-500);font-size:1rem;">${grant.funder}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="info-box">
        <h3>Funding Amount</h3>
        <div class="value amount">${formatAmountRange(grant.amountMin, grant.amountMax)}</div>
      </div>
      <div class="info-box">
        <h3>Deadline</h3>
        <div class="value">${deadlineText}${deadlineNote}</div>
      </div>
      <div class="info-box">
        <h3>Category</h3>
        <div class="value" style="font-size:1rem;">${grant.category}</div>
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <h3 style="font-size:0.9rem;font-weight:700;color:var(--navy);margin-bottom:8px;">Description</h3>
      <p style="color:var(--gray-600);line-height:1.8;">${grant.description}</p>
    </div>
    <div style="margin-bottom:20px;">
      <h3 style="font-size:0.9rem;font-weight:700;color:var(--navy);margin-bottom:8px;">Eligibility</h3>
      <p style="color:var(--gray-600);line-height:1.8;">${grant.eligibility}</p>
    </div>
    <div style="margin-bottom:24px;">
      <h3 style="font-size:0.9rem;font-weight:700;color:var(--navy);margin-bottom:8px;">Eligible States</h3>
      <p style="color:var(--gray-600);">${statesText}</p>
    </div>
    <div style="display:flex;gap:12px;">
      <a href="${grant.applicationUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg" style="flex:1;justify-content:center;">Apply Now</a>
      <button class="btn btn-secondary btn-lg" onclick="closeModal()">Close</button>
    </div>
  `;

  let overlay = document.getElementById('grantModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'grantModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal"></div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }

  overlay.querySelector('.modal').innerHTML = html;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('grantModal');
  if (overlay) {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Mobile menu toggle
function toggleMobileMenu() {
  const links = document.querySelector('.navbar-links');
  if (links) links.classList.toggle('open');
}

// Toast notification
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

// Shared navbar HTML
function getNavbarHTML(activePage) {
  return `
    <nav class="navbar">
      <div class="container">
        <a href="/" class="navbar-brand">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#1a1a2e"/>
            <path d="M8 16L14 10L20 16L14 22Z" fill="#00b4d8"/>
            <path d="M14 16L20 10L26 16L20 22Z" fill="#10b981" opacity="0.8"/>
          </svg>
          Grant<span class="accent">Finder</span>
        </a>
        <ul class="navbar-links">
          <li><a href="/" class="${activePage === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="/grants/" class="${activePage === 'grants' ? 'active' : ''}">Grants</a></li>
          <li><a href="/categories/" class="${activePage === 'categories' ? 'active' : ''}">Categories</a></li>
          <li><a href="/states/" class="${activePage === 'states' ? 'active' : ''}">States</a></li>
          <li><a href="/blog/" class="${activePage === 'blog' ? 'active' : ''}">Blog</a></li>
          <li><a href="/about/" class="${activePage === 'about' ? 'active' : ''}">About</a></li>
          <li><a href="/submit/" class="navbar-cta">Submit Grant</a></li>
        </ul>
        <button class="mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Toggle menu">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
    </nav>
  `;
}

// Shared footer HTML
function getFooterHTML() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">Grant<span class="accent">Finder</span></div>
            <p class="footer-desc">The most comprehensive nonprofit grant database in the United States. Helping organizations find and secure funding since 2024.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul class="footer-links">
              <li><a href="/grants/">Browse Grants</a></li>
              <li><a href="/categories/">Categories</a></li>
              <li><a href="/states/">By State</a></li>
              <li><a href="/blog/">Blog</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul class="footer-links">
              <li><a href="/submit/">Submit a Grant</a></li>
              <li><a href="/about/">About Us</a></li>
              <li><a href="/blog/">Grant Writing Tips</a></li>
              <li><a href="https://www.grants.gov" target="_blank">Grants.gov</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul class="footer-links">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} GrantFinder. All rights reserved.</span>
          <span>Made with purpose for nonprofits everywhere.</span>
        </div>
      </div>
    </footer>
  `;
}
