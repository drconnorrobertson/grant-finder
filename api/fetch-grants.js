/**
 * Vercel Serverless Function - Fetch Grants
 *
 * Runs as a daily cron job to fetch new grants from Grants.gov
 * and update the repository via GitHub API.
 *
 * Environment variables required:
 * - GITHUB_TOKEN: Personal access token with repo write access
 * - GITHUB_REPO: Repository in format "owner/repo"
 * - CRON_SECRET: Secret to protect the endpoint (optional but recommended)
 */

export const config = {
  maxDuration: 60, // Allow up to 60 seconds
};

const GRANTS_GOV_API = 'https://www.grants.gov/grantsws/rest/opportunities/search';

async function fetchFromGrantsGov() {
  const response = await fetch(GRANTS_GOV_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      keyword: '',
      oppNum: '',
      cfda: '',
      eligibilities: '25',
      fundingCategories: '',
      rows: 50,
      sortBy: 'openDate|desc'
    })
  });

  if (!response.ok) {
    throw new Error(`Grants.gov API returned ${response.status}`);
  }

  const data = await response.json();
  return data.oppHits || [];
}

async function updateViaGitHub(newGrants) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'drconnorrobertson/grant-finder';

  if (!token) {
    console.log('No GITHUB_TOKEN set, skipping GitHub update');
    return { updated: false, reason: 'No GitHub token configured' };
  }

  // Get current file content
  const getResponse = await fetch(
    `https://api.github.com/repos/${repo}/contents/data/grants.js`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );

  if (!getResponse.ok) {
    throw new Error(`GitHub API error: ${getResponse.status}`);
  }

  const fileData = await getResponse.json();
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

  // Parse existing grants count for the log
  const existingCount = (currentContent.match(/id:/g) || []).length;

  // Append new grants before the closing ];
  if (newGrants.length === 0) {
    return { updated: false, reason: 'No new grants to add', existingCount };
  }

  const today = new Date().toISOString().split('T')[0];
  const newGrantsJs = newGrants.map((grant, i) => {
    const id = existingCount + i + 1;
    return `  {
    id: ${id},
    title: ${JSON.stringify(grant.title)},
    funder: ${JSON.stringify(grant.funder || 'Federal Government')},
    amountMin: ${grant.awardFloor || 10000},
    amountMax: ${grant.awardCeiling || 500000},
    deadline: ${JSON.stringify(grant.closeDate ? new Date(grant.closeDate).toISOString().split('T')[0] : 'Rolling')},
    category: "Social Services",
    states: ["National"],
    description: ${JSON.stringify((grant.description || grant.synopsis || 'Federal grant opportunity.').substring(0, 500))},
    eligibility: "Nonprofit organizations with 501(c)(3) status.",
    applicationUrl: "https://www.grants.gov/search-results-detail/${grant.oppNum || grant.id}",
    dateAdded: "${today}",
    featured: false
  }`;
  }).join(',\n');

  const updatedContent = currentContent.replace(
    /\n\];\s*\n/,
    `,\n${newGrantsJs}\n];\n`
  );

  // Commit the update
  const updateResponse = await fetch(
    `https://api.github.com/repos/${repo}/contents/data/grants.js`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Auto-update grants database ${today}`,
        content: Buffer.from(updatedContent).toString('base64'),
        sha: fileData.sha,
        committer: {
          name: 'Grant Finder Bot',
          email: 'bot@grantfinder.com'
        }
      })
    }
  );

  if (!updateResponse.ok) {
    const errorBody = await updateResponse.text();
    throw new Error(`GitHub commit failed: ${updateResponse.status} - ${errorBody}`);
  }

  return {
    updated: true,
    grantsAdded: newGrants.length,
    totalGrants: existingCount + newGrants.length
  };
}

export default async function handler(req, res) {
  // Verify cron secret if configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('Starting grant fetch...');

    // Fetch from Grants.gov
    const opportunities = await fetchFromGrantsGov();
    console.log(`Fetched ${opportunities.length} opportunities`);

    // Filter for recent (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOpps = opportunities.filter(opp => {
      if (!opp.openDate) return true;
      return new Date(opp.openDate) >= sevenDaysAgo;
    });

    // Update via GitHub API
    const result = await updateViaGitHub(recentOpps);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      fetched: opportunities.length,
      recent: recentOpps.length,
      ...result
    });

  } catch (error) {
    console.error('Grant fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
