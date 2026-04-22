/**
 * Grant Merger & Deduplicator
 *
 * Takes grants from multiple sources (Grants.gov, state portals, existing data)
 * and merges them into a single deduplicated dataset. Updates the grants-data.js file.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GRANTS_DATA_PATH = join(__dirname, '..', 'data', 'grants.js');

/**
 * Parse existing grants from the grants.js file
 */
function parseExistingGrants() {
  try {
    const content = readFileSync(GRANTS_DATA_PATH, 'utf-8');

    // Extract the GRANTS_DATA array
    const match = content.match(/const GRANTS_DATA = \[([\s\S]*?)\];/);
    if (!match) {
      console.log('Could not parse existing grants data');
      return [];
    }

    // Use eval in a controlled way to parse the JS array
    // (We control this file so this is safe)
    const grantsStr = `[${match[1]}]`;
    const grants = eval(grantsStr);
    return grants;
  } catch (error) {
    console.error('Error parsing existing grants:', error.message);
    return [];
  }
}

/**
 * Generate a fingerprint for deduplication
 * Uses title similarity and funder to detect duplicates
 */
function getFingerprint(grant) {
  const title = (grant.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const funder = (grant.funder || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${title}__${funder}`;
}

/**
 * Check if two grants are duplicates using fuzzy matching
 */
function isDuplicate(a, b) {
  // Exact sourceId match
  if (a.sourceId && b.sourceId && a.sourceId === b.sourceId) return true;

  // Fingerprint match
  if (getFingerprint(a) === getFingerprint(b)) return true;

  // Title similarity check (Jaccard similarity on words)
  const wordsA = new Set((a.title || '').toLowerCase().split(/\s+/));
  const wordsB = new Set((b.title || '').toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const similarity = union.size > 0 ? intersection.size / union.size : 0;

  if (similarity > 0.8 && a.funder === b.funder) return true;

  return false;
}

/**
 * Merge multiple grant arrays, removing duplicates
 * Existing grants take priority (they have been curated)
 */
function mergeGrants(existingGrants, ...newGrantArrays) {
  const merged = [...existingGrants];
  const fingerprints = new Set(existingGrants.map(g => getFingerprint(g)));

  let added = 0;
  let skipped = 0;

  for (const newGrants of newGrantArrays) {
    for (const newGrant of newGrants) {
      const fp = getFingerprint(newGrant);

      // Check fingerprint first (fast)
      if (fingerprints.has(fp)) {
        skipped++;
        continue;
      }

      // Check fuzzy duplicates (slower but more thorough)
      const isDup = merged.some(existing => isDuplicate(existing, newGrant));
      if (isDup) {
        skipped++;
        continue;
      }

      fingerprints.add(fp);
      merged.push(newGrant);
      added++;
    }
  }

  console.log(`Merge result: ${added} new grants added, ${skipped} duplicates skipped`);
  console.log(`Total grants: ${merged.length}`);

  // Reassign sequential IDs
  merged.forEach((grant, index) => {
    grant.id = index + 1;
  });

  return merged;
}

/**
 * Write merged grants back to grants.js
 * Preserves the CATEGORIES and US_STATES constants
 */
function writeGrantsFile(grants) {
  const content = readFileSync(GRANTS_DATA_PATH, 'utf-8');

  // Extract everything after the GRANTS_DATA array
  const afterArray = content.substring(content.indexOf('];') + 2);

  // Build new grants array
  const grantsJson = grants.map(grant => {
    // Clean up grant object for output (remove internal fields)
    const clean = { ...grant };
    delete clean.source;
    delete clean.sourceId;

    return `  {
    id: ${clean.id},
    title: ${JSON.stringify(clean.title)},
    funder: ${JSON.stringify(clean.funder)},
    amountMin: ${clean.amountMin},
    amountMax: ${clean.amountMax},
    deadline: ${JSON.stringify(clean.deadline)},
    category: ${JSON.stringify(clean.category)},
    states: ${JSON.stringify(clean.states)},
    description: ${JSON.stringify(clean.description)},
    eligibility: ${JSON.stringify(clean.eligibility)},
    applicationUrl: ${JSON.stringify(clean.applicationUrl)},
    dateAdded: ${JSON.stringify(clean.dateAdded)},
    featured: ${clean.featured || false}
  }`;
  }).join(',\n');

  const newContent = `const GRANTS_DATA = [\n${grantsJson}\n];${afterArray}`;

  writeFileSync(GRANTS_DATA_PATH, newContent, 'utf-8');
  console.log(`Wrote ${grants.length} grants to ${GRANTS_DATA_PATH}`);
}

/**
 * Generate RSS feed XML
 */
function generateRSS(grants) {
  const recentGrants = grants
    .filter(g => g.dateAdded)
    .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''))
    .slice(0, 50);

  const now = new Date().toUTCString();

  const items = recentGrants.map(grant => `
    <item>
      <title><![CDATA[${grant.title}]]></title>
      <link>${grant.applicationUrl}</link>
      <description><![CDATA[${grant.description} | Funding: $${grant.amountMin.toLocaleString()} - $${grant.amountMax.toLocaleString()} | Deadline: ${grant.deadline} | Category: ${grant.category}]]></description>
      <category>${grant.category}</category>
      <pubDate>${new Date(grant.dateAdded + 'T12:00:00Z').toUTCString()}</pubDate>
      <guid isPermaLink="false">grantfinder-${grant.id}</guid>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GrantFinder - Latest Nonprofit Grants</title>
    <link>https://grantfinder.org</link>
    <description>The latest nonprofit grant opportunities from federal, state, and private sources. Updated daily.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://grantfinder.org/feed.xml" rel="self" type="application/rss+xml"/>
    <ttl>1440</ttl>
    <image>
      <url>https://grantfinder.org/images/logo.png</url>
      <title>GrantFinder</title>
      <link>https://grantfinder.org</link>
    </image>
${items}
  </channel>
</rss>`;

  const rssPath = join(__dirname, '..', 'feed.xml');
  writeFileSync(rssPath, rss, 'utf-8');
  console.log(`Wrote RSS feed with ${recentGrants.length} items to feed.xml`);
}

export { parseExistingGrants, mergeGrants, writeGrantsFile, generateRSS, isDuplicate };
