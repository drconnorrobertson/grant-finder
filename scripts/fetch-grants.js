#!/usr/bin/env node

/**
 * Grant Fetcher Orchestrator
 *
 * Main entry point that coordinates all grant data sources:
 * 1. Fetches from Grants.gov API (federal grants)
 * 2. Fetches from state grant portals
 * 3. Merges with existing grant database
 * 4. Deduplicates and writes updated grants-data.js
 * 5. Generates RSS feed
 *
 * Usage:
 *   node scripts/fetch-grants.js              # Fetch all sources
 *   node scripts/fetch-grants.js --federal     # Federal only
 *   node scripts/fetch-grants.js --state       # State only
 *   node scripts/fetch-grants.js --dry-run     # Preview without writing
 */

import { fetchGrantsGov } from './fetch-grants-gov.js';
import { fetchStateGrants } from './fetch-state-grants.js';
import { parseExistingGrants, mergeGrants, writeGrantsFile, generateRSS } from './merge-grants.js';

const args = process.argv.slice(2);
const federalOnly = args.includes('--federal');
const stateOnly = args.includes('--state');
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('='.repeat(60));
  console.log('GrantFinder - Automated Grant Data Update');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Step 1: Parse existing grants
  console.log('\n--- Step 1: Loading existing grants ---');
  const existingGrants = parseExistingGrants();
  console.log(`Loaded ${existingGrants.length} existing grants`);

  // Step 2: Fetch from sources
  let federalGrants = [];
  let stateGrants = [];

  if (!stateOnly) {
    console.log('\n--- Step 2a: Fetching federal grants from Grants.gov ---');
    try {
      federalGrants = await fetchGrantsGov();
      console.log(`Fetched ${federalGrants.length} federal grants`);
    } catch (error) {
      console.error(`Federal grants fetch failed: ${error.message}`);
      console.log('Continuing with other sources...');
    }
  }

  if (!federalOnly) {
    console.log('\n--- Step 2b: Fetching state grants ---');
    try {
      stateGrants = await fetchStateGrants();
      console.log(`Fetched ${stateGrants.length} state grants`);
    } catch (error) {
      console.error(`State grants fetch failed: ${error.message}`);
      console.log('Continuing with other sources...');
    }
  }

  // Step 3: Merge and deduplicate
  console.log('\n--- Step 3: Merging and deduplicating ---');
  const mergedGrants = mergeGrants(existingGrants, federalGrants, stateGrants);

  if (dryRun) {
    console.log('\n[DRY RUN] Would write the following changes:');
    console.log(`Total grants: ${mergedGrants.length}`);
    console.log(`New grants: ${mergedGrants.length - existingGrants.length}`);

    const newGrants = mergedGrants.slice(existingGrants.length);
    if (newGrants.length > 0) {
      console.log('\nNew grants that would be added:');
      newGrants.forEach(g => {
        console.log(`  - ${g.title} (${g.funder}) [${g.category}]`);
      });
    }
    return;
  }

  // Step 4: Write updated grants file
  console.log('\n--- Step 4: Writing updated grants file ---');
  writeGrantsFile(mergedGrants);

  // Step 5: Generate RSS feed
  console.log('\n--- Step 5: Generating RSS feed ---');
  generateRSS(mergedGrants);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Update Complete!');
  console.log(`Total grants in database: ${mergedGrants.length}`);
  console.log(`New grants added: ${mergedGrants.length - existingGrants.length}`);
  console.log(`Federal grants fetched: ${federalGrants.length}`);
  console.log(`State grants fetched: ${stateGrants.length}`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
