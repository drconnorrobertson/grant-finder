/**
 * Grants.gov API Fetcher
 *
 * Calls the Grants.gov REST API to pull nonprofit-eligible federal grants
 * posted in the last 7 days. Converts them to the GrantFinder JSON format.
 *
 * API Docs: https://www.grants.gov/web-services
 * Eligibility code 25 = Nonprofits having a 501(c)(3) status
 */

const GRANTS_GOV_API = 'https://www.grants.gov/grantsws/rest/opportunities/search';
const GRANT_DETAIL_URL = 'https://www.grants.gov/grantsws/rest/opportunity/details';

// Category mapping from Grants.gov funding categories to our categories
const CATEGORY_MAP = {
  'AG': 'Environment',           // Agriculture
  'AR': 'Arts & Culture',        // Arts
  'BC': 'Social Services',       // Business and Commerce
  'CD': 'Community Development', // Community Development
  'CP': 'Social Services',       // Consumer Protection
  'DPR': 'Social Services',     // Disaster Prevention and Relief
  'ED': 'Education',            // Education
  'ELT': 'Technology',          // Employment, Labor and Training
  'EN': 'Environment',          // Energy
  'ENV': 'Environment',         // Environment
  'FN': 'Social Services',      // Food and Nutrition
  'HL': 'Health',               // Health
  'HO': 'Housing',             // Housing
  'HU': 'Social Services',     // Humanities
  'IIJ': 'Social Services',    // Income Security and Social Services
  'IS': 'Technology',           // Information and Statistics
  'ISS': 'Social Services',    // Income Security and Social Services
  'LJL': 'Social Services',    // Law, Justice and Legal Services
  'NR': 'Environment',         // Natural Resources
  'O': 'Community Development', // Other
  'OZ': 'Community Development',// Opportunity Zone Benefits
  'RA': 'Research',            // Recovery Act
  'RD': 'Community Development',// Regional Development
  'ST': 'Research',            // Science and Technology
  'T': 'Community Development', // Transportation
};

// Map CFDA prefixes to funders
const FUNDER_MAP = {
  '10': 'U.S. Department of Agriculture',
  '11': 'U.S. Department of Commerce',
  '12': 'U.S. Department of Defense',
  '14': 'U.S. Department of Housing and Urban Development',
  '15': 'U.S. Department of the Interior',
  '16': 'U.S. Department of Justice',
  '17': 'U.S. Department of Labor',
  '19': 'U.S. Department of State',
  '20': 'U.S. Department of Transportation',
  '43': 'National Aeronautics and Space Administration',
  '45': 'National Endowment for the Arts / Humanities',
  '47': 'National Science Foundation',
  '59': 'Small Business Administration',
  '64': 'U.S. Department of Veterans Affairs',
  '66': 'U.S. Environmental Protection Agency',
  '81': 'U.S. Department of Energy',
  '84': 'U.S. Department of Education',
  '93': 'U.S. Department of Health and Human Services',
  '94': 'Corporation for National and Community Service',
  '96': 'Social Security Administration',
  '97': 'U.S. Department of Homeland Security',
};

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatGrantsGovDate(dateStr) {
  if (!dateStr) return 'Rolling';
  // Grants.gov dates come as "MM/DD/YYYY" or epoch
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  }
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

function inferCategory(opportunity) {
  // Try to map from funding category
  if (opportunity.fundingCategories) {
    const cats = opportunity.fundingCategories.split(',').map(c => c.trim());
    for (const cat of cats) {
      if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
    }
  }

  // Fall back to keyword analysis of title/description
  const text = ((opportunity.title || '') + ' ' + (opportunity.description || '')).toLowerCase();
  if (text.includes('education') || text.includes('school') || text.includes('student')) return 'Education';
  if (text.includes('health') || text.includes('medical') || text.includes('disease')) return 'Health';
  if (text.includes('environment') || text.includes('climate') || text.includes('conservation')) return 'Environment';
  if (text.includes('housing') || text.includes('homeless')) return 'Housing';
  if (text.includes('arts') || text.includes('cultural') || text.includes('museum')) return 'Arts & Culture';
  if (text.includes('technology') || text.includes('cyber') || text.includes('digital')) return 'Technology';
  if (text.includes('youth') || text.includes('children') || text.includes('juvenile')) return 'Youth Development';
  if (text.includes('research') || text.includes('science') || text.includes('study')) return 'Research';
  if (text.includes('community') || text.includes('rural') || text.includes('urban')) return 'Community Development';

  return 'Social Services';
}

function inferFunder(opportunity) {
  // Try agency name first
  if (opportunity.agencyName) return opportunity.agencyName;

  // Try CFDA number prefix
  if (opportunity.cfdaNumber) {
    const prefix = opportunity.cfdaNumber.split('.')[0];
    if (FUNDER_MAP[prefix]) return FUNDER_MAP[prefix];
  }

  return 'Federal Government';
}

function parseAwardAmounts(opportunity) {
  let min = 0;
  let max = 0;

  if (opportunity.awardCeiling) {
    max = parseInt(opportunity.awardCeiling, 10) || 0;
  }
  if (opportunity.awardFloor) {
    min = parseInt(opportunity.awardFloor, 10) || 0;
  }

  // If no floor but has ceiling, set reasonable floor
  if (max > 0 && min === 0) {
    min = Math.max(1000, Math.floor(max * 0.1));
  }

  // If no ceiling but has floor, estimate ceiling
  if (min > 0 && max === 0) {
    max = min * 10;
  }

  // Default amounts if nothing available
  if (min === 0 && max === 0) {
    min = 10000;
    max = 500000;
  }

  return { min, max };
}

function convertToGrantFormat(opportunity, startingId) {
  const amounts = parseAwardAmounts(opportunity);
  const closeDate = formatGrantsGovDate(opportunity.closeDate || opportunity.archiveDate);
  const today = new Date().toISOString().split('T')[0];

  return {
    id: startingId,
    title: opportunity.title || opportunity.opportunityTitle || 'Untitled Federal Grant',
    funder: inferFunder(opportunity),
    amountMin: amounts.min,
    amountMax: amounts.max,
    deadline: closeDate,
    category: inferCategory(opportunity),
    states: ['National'],
    description: (opportunity.description || opportunity.synopsis || 'Federal grant opportunity. Visit Grants.gov for full details.').substring(0, 500),
    eligibility: 'Nonprofit organizations with 501(c)(3) status. See full opportunity listing for detailed eligibility requirements.',
    applicationUrl: `https://www.grants.gov/search-results-detail/${opportunity.oppNum || opportunity.opportunityNumber || opportunity.id}`,
    dateAdded: today,
    featured: false,
    source: 'grants.gov',
    sourceId: String(opportunity.oppNum || opportunity.opportunityNumber || opportunity.id || '')
  };
}

async function fetchGrantsGov() {
  // Dynamic import for node-fetch (ESM)
  const fetch = (await import('node-fetch')).default;

  console.log('Fetching nonprofit grants from Grants.gov...');

  const requestBody = {
    keyword: '',
    oppNum: '',
    cfda: '',
    eligibilities: '25',       // 25 = Nonprofits (501c3)
    fundingCategories: '',
    rows: 100,
    sortBy: 'openDate|desc'
  };

  try {
    const response = await fetch(GRANTS_GOV_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      timeout: 30000
    });

    if (!response.ok) {
      console.error(`Grants.gov API returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data || !data.oppHits) {
      console.log('No opportunities found in Grants.gov response');
      return [];
    }

    const opportunities = data.oppHits;
    console.log(`Found ${opportunities.length} opportunities from Grants.gov`);

    // Filter for grants posted in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOpps = opportunities.filter(opp => {
      if (!opp.openDate && !opp.postedDate) return true; // Include if no date
      const oppDate = new Date(opp.openDate || opp.postedDate);
      return oppDate >= sevenDaysAgo;
    });

    console.log(`${recentOpps.length} grants posted in the last 7 days`);

    // Filter out closed/archived grants
    const now = new Date();
    const activeOpps = recentOpps.filter(opp => {
      if (!opp.closeDate) return true;
      const closeDate = new Date(opp.closeDate);
      return closeDate > now;
    });

    console.log(`${activeOpps.length} active grants after filtering closed ones`);

    // Convert to our format (IDs will be reassigned during merge)
    const grants = activeOpps.map((opp, i) => convertToGrantFormat(opp, 10000 + i));

    return grants;

  } catch (error) {
    console.error('Error fetching from Grants.gov:', error.message);
    return [];
  }
}

// Allow running standalone or as module
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchGrantsGov().then(grants => {
    console.log(`\nFetched ${grants.length} grants from Grants.gov`);
    if (grants.length > 0) {
      console.log('\nSample grant:');
      console.log(JSON.stringify(grants[0], null, 2));
    }
    // Write to temp file for merge script
    const fs = await import('fs');
    fs.writeFileSync(
      new URL('../data/grants-gov-latest.json', import.meta.url).pathname,
      JSON.stringify(grants, null, 2)
    );
    console.log('Wrote grants to data/grants-gov-latest.json');
  });
}

export { fetchGrantsGov, convertToGrantFormat };
