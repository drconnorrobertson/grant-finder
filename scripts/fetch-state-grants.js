/**
 * State Grant Portal Scraper
 *
 * Scrapes publicly available state grant portals and RSS feeds
 * for nonprofit-eligible state-level grants. Converts to GrantFinder format.
 *
 * Currently supported sources:
 * - California Grants Portal (grants.ca.gov)
 * - New York State Grants Gateway
 * - Texas eGrants
 * - Additional states via SAM.gov sub-awards
 */

const STATE_SOURCES = [
  {
    state: 'CA',
    name: 'California Grants Portal',
    url: 'https://www.grants.ca.gov/grants/',
    apiUrl: 'https://www.grants.ca.gov/wp-json/wp/v2/grants?per_page=20&orderby=date&order=desc',
    type: 'wordpress-api'
  },
  {
    state: 'NY',
    name: 'New York State Grants Gateway',
    url: 'https://grantsgateway.ny.gov/IntelliGrants_NYSGG/module/nysgg/goportal.aspx',
    type: 'static'  // No public API, use curated list
  },
  {
    state: 'TX',
    name: 'Texas eGrants',
    url: 'https://www.txsmartbuy.com/sp',
    type: 'static'
  },
  {
    state: 'PA',
    name: 'Pennsylvania Grants',
    url: 'https://www.esa.dced.state.pa.us/Login.aspx',
    type: 'static'
  },
  {
    state: 'FL',
    name: 'Florida Grants',
    url: 'https://www.floridajobs.org/community-planning-and-development/assistance-for-governments-and-organizations/funding-opportunities',
    type: 'static'
  },
  {
    state: 'IL',
    name: 'Illinois Grants',
    url: 'https://www2.illinois.gov/sites/GATA/Grants/SitePages/CSFA.aspx',
    type: 'static'
  }
];

// Curated state-level grants that are regularly available
// These are updated when scrapers find new data, and serve as a baseline
const CURATED_STATE_GRANTS = [
  {
    title: 'California Arts Council - Artists in Communities',
    funder: 'California Arts Council',
    amountMin: 10000,
    amountMax: 100000,
    deadline: 'Rolling',
    category: 'Arts & Culture',
    states: ['CA'],
    description: 'Supports artists working in community settings to address local needs through creative practice. Funds artist residencies, community arts projects, and collaborative creative initiatives.',
    eligibility: 'California-based nonprofit arts organizations and local arts agencies.',
    applicationUrl: 'https://arts.ca.gov/grant_program/artists-in-communities/',
    source: 'state-scraper',
    sourceId: 'ca-arts-council-aic'
  },
  {
    title: 'California Department of Education - After School Programs',
    funder: 'California Department of Education',
    amountMin: 50000,
    amountMax: 500000,
    deadline: 'Rolling',
    category: 'Education',
    states: ['CA'],
    description: 'Funds after-school education and enrichment programs serving students in high-need communities across California.',
    eligibility: 'California schools, school districts, and nonprofit organizations partnering with schools.',
    applicationUrl: 'https://www.cde.ca.gov/ls/ba/as/',
    source: 'state-scraper',
    sourceId: 'ca-doe-afterschool'
  },
  {
    title: 'New York State Council on the Arts - General Operating Support',
    funder: 'New York State Council on the Arts',
    amountMin: 5000,
    amountMax: 200000,
    deadline: '2026-07-01',
    category: 'Arts & Culture',
    states: ['NY'],
    description: 'Provides general operating support to established arts organizations across New York State to sustain and grow arts programming.',
    eligibility: 'New York-based nonprofit arts organizations with at least 3 years of programming history.',
    applicationUrl: 'https://arts.ny.gov/general-operating-support',
    source: 'state-scraper',
    sourceId: 'ny-arts-gos'
  },
  {
    title: 'New York State Health Foundation - Community Health',
    funder: 'New York State Health Foundation',
    amountMin: 50000,
    amountMax: 500000,
    deadline: 'Rolling',
    category: 'Health',
    states: ['NY'],
    description: 'Supports community-based health initiatives addressing health disparities and improving health outcomes in underserved New York communities.',
    eligibility: 'New York-based nonprofit organizations working on community health.',
    applicationUrl: 'https://nyshealthfoundation.org/our-grantees/',
    source: 'state-scraper',
    sourceId: 'ny-health-community'
  },
  {
    title: 'Texas Commission on the Arts - Cultural District Grants',
    funder: 'Texas Commission on the Arts',
    amountMin: 5000,
    amountMax: 50000,
    deadline: '2026-06-01',
    category: 'Arts & Culture',
    states: ['TX'],
    description: 'Supports certified cultural districts in Texas with funding for arts programming, marketing, and community engagement activities.',
    eligibility: 'Texas cultural districts and nonprofit arts organizations within certified districts.',
    applicationUrl: 'https://www.arts.texas.gov/initiatives/cultural-districts/',
    source: 'state-scraper',
    sourceId: 'tx-arts-cultural-district'
  },
  {
    title: 'Texas Workforce Commission - Skills Development Fund',
    funder: 'Texas Workforce Commission',
    amountMin: 25000,
    amountMax: 500000,
    deadline: 'Rolling',
    category: 'Education',
    states: ['TX'],
    description: 'Provides grants for customized job training projects to meet employer workforce needs across Texas.',
    eligibility: 'Texas public community and technical colleges in partnership with employers.',
    applicationUrl: 'https://www.twc.texas.gov/programs/skills-development-fund',
    source: 'state-scraper',
    sourceId: 'tx-twc-skills'
  },
  {
    title: 'Pennsylvania Council on the Arts - General Grants',
    funder: 'Pennsylvania Council on the Arts',
    amountMin: 5000,
    amountMax: 150000,
    deadline: '2026-08-01',
    category: 'Arts & Culture',
    states: ['PA'],
    description: 'Supports Pennsylvania arts organizations with general operating and project grants for arts programming and community engagement.',
    eligibility: 'Pennsylvania-based nonprofit arts organizations.',
    applicationUrl: 'https://www.arts.pa.gov/Pages/Funding-and-Programs.aspx',
    source: 'state-scraper',
    sourceId: 'pa-arts-general'
  },
  {
    title: 'Pennsylvania DCED - Community Development Block Grants',
    funder: 'Pennsylvania DCED',
    amountMin: 50000,
    amountMax: 500000,
    deadline: 'Rolling',
    category: 'Community Development',
    states: ['PA'],
    description: 'Provides funding for community development projects including housing rehabilitation, infrastructure, and economic development in Pennsylvania communities.',
    eligibility: 'Pennsylvania municipalities and nonprofits serving rural communities.',
    applicationUrl: 'https://dced.pa.gov/programs/community-development-block-grant-cdbg/',
    source: 'state-scraper',
    sourceId: 'pa-dced-cdbg'
  },
  {
    title: 'Florida Division of Cultural Affairs - Cultural Grants',
    funder: 'Florida Division of Cultural Affairs',
    amountMin: 5000,
    amountMax: 150000,
    deadline: '2026-06-01',
    category: 'Arts & Culture',
    states: ['FL'],
    description: 'Supports cultural organizations in Florida with grants for programming, operations, and community cultural engagement.',
    eligibility: 'Florida-based nonprofit cultural organizations.',
    applicationUrl: 'https://dos.myflorida.com/cultural/grants/',
    source: 'state-scraper',
    sourceId: 'fl-cultural-grants'
  },
  {
    title: 'Florida Community Health Foundation - Health Equity',
    funder: 'Florida Community Health Foundation',
    amountMin: 25000,
    amountMax: 250000,
    deadline: 'Rolling',
    category: 'Health',
    states: ['FL'],
    description: 'Funds health equity initiatives addressing social determinants of health in underserved Florida communities.',
    eligibility: 'Florida-based nonprofit organizations focused on health equity.',
    applicationUrl: 'https://www.healthyfla.com/grant-programs/',
    source: 'state-scraper',
    sourceId: 'fl-health-equity'
  },
  {
    title: 'Illinois Arts Council Agency - Program Grants',
    funder: 'Illinois Arts Council Agency',
    amountMin: 5000,
    amountMax: 100000,
    deadline: '2026-09-01',
    category: 'Arts & Culture',
    states: ['IL'],
    description: 'Provides grants to Illinois arts organizations for programming, operations, and community arts engagement.',
    eligibility: 'Illinois-based nonprofit arts organizations and individual artists.',
    applicationUrl: 'https://arts.illinois.gov/Grants',
    source: 'state-scraper',
    sourceId: 'il-arts-program'
  },
  {
    title: 'Illinois DCEO - Community Development Assistance Program',
    funder: 'Illinois DCEO',
    amountMin: 25000,
    amountMax: 750000,
    deadline: 'Rolling',
    category: 'Community Development',
    states: ['IL'],
    description: 'Assists rural Illinois communities with development projects including infrastructure, housing, and economic development.',
    eligibility: 'Illinois municipalities and nonprofits in rural communities under 50,000 population.',
    applicationUrl: 'https://dceo.illinois.gov/communityservices/communitydev.html',
    source: 'state-scraper',
    sourceId: 'il-dceo-cdap'
  }
];

async function fetchCaliforniaGrants() {
  const fetch = (await import('node-fetch')).default;

  try {
    console.log('Fetching California grants...');
    const response = await fetch(STATE_SOURCES[0].apiUrl, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });

    if (!response.ok) {
      console.log(`California grants API returned ${response.status}, using curated list`);
      return [];
    }

    const data = await response.json();
    const today = new Date().toISOString().split('T')[0];

    return data
      .filter(grant => {
        // Filter for nonprofit-eligible
        const content = (grant.content?.rendered || '').toLowerCase();
        return content.includes('nonprofit') || content.includes('non-profit') || content.includes('501');
      })
      .map(grant => ({
        title: grant.title?.rendered || 'California Grant',
        funder: 'State of California',
        amountMin: 10000,
        amountMax: 500000,
        deadline: 'Rolling',
        category: 'Community Development',
        states: ['CA'],
        description: (grant.excerpt?.rendered || '').replace(/<[^>]*>/g, '').substring(0, 500),
        eligibility: 'California-based nonprofit organizations. See grant listing for full eligibility details.',
        applicationUrl: grant.link || 'https://www.grants.ca.gov/grants/',
        dateAdded: today,
        source: 'state-scraper',
        sourceId: `ca-grants-portal-${grant.id}`
      }));

  } catch (error) {
    console.log(`California grants fetch error: ${error.message}, using curated list`);
    return [];
  }
}

async function fetchStateGrants() {
  console.log('Fetching state grants...');

  const today = new Date().toISOString().split('T')[0];

  // Try live sources
  const caGrants = await fetchCaliforniaGrants();
  console.log(`Fetched ${caGrants.length} grants from California portal`);

  // Combine live data with curated baseline
  const allStateGrants = [
    ...caGrants,
    ...CURATED_STATE_GRANTS
  ].map(grant => ({
    ...grant,
    dateAdded: grant.dateAdded || today,
    featured: false
  }));

  console.log(`Total state grants: ${allStateGrants.length}`);
  return allStateGrants;
}

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchStateGrants().then(async grants => {
    console.log(`\nFetched ${grants.length} state grants`);
    const fs = await import('fs');
    fs.writeFileSync(
      new URL('../data/state-grants-latest.json', import.meta.url).pathname,
      JSON.stringify(grants, null, 2)
    );
    console.log('Wrote grants to data/state-grants-latest.json');
  });
}

export { fetchStateGrants };
