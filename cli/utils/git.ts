// Copyright 2025 TATI Mohammed

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { output } from './output';

const git = simpleGit();
const outputPath = path.resolve(process.cwd(), '.git/gittyx.json');

/**
 * Validates that the current directory is a git repository
 * Throws an error with a clean message if not a git repo
 */
export async function validateGitRepo(): Promise<void> {
  try {
    // Try to get the git status to verify we're in a git repo
    await git.status();
  } catch (err) {
    throw new Error('Not a git repository. Please run this command from within a git repository.');
  }
}

/**
 * Checks if the repository has any tags
 * Returns true if tags exist, false otherwise
 */
export async function hasRepositoryTags(): Promise<boolean> {
  try {
    const tags = await git.tags();
    return tags.all && tags.all.length > 0;
  } catch (err) {
    output.debug(`Error checking tags: ${err}`);
    return false;
  }
}

/**
 * Fetches the latest commits with their diffs
 * Also validates repo and checks for tags
 */
export async function getCommitsWithDiffs(limit = 200): Promise<void> {
  // First validate that we're in a git repo
  try {
    await validateGitRepo();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }

  // Check if repository has tags and warn if not
  const hasTags = await hasRepositoryTags();
  if (!hasTags) {
    output.warn('No tags found in repository. The compareEpochs feature requires tags to work properly.');
  }

  output.debug(`Fetching latest ${limit} commits with diffs...`);
  try {
    // Read existing commits if file exists
    let existingCommits = [];
    if (fs.existsSync(outputPath)) {
      const raw = await fs.promises.readFile(outputPath, 'utf-8');
      existingCommits = JSON.parse(raw);
    }

    // Get hashes of existing commits for quick lookup
    const existingHashes = new Set(existingCommits.map(c => c.hash));

    // Get latest commits from git log
    const log = await git.log({ maxCount: limit });

    // Filter commits that are not already in the file
    const newCommits = log.all.filter(c => !existingHashes.has(c.hash));

    if (newCommits.length === 0) {
      output.debug('No new commits to add.');
      return;
    }

    // For each new commit, get its diff
    const commitsWithDiffs = await Promise.all(
      newCommits.map(async (commit) => {
        const diff = await git.diff([`${commit.hash}^!`]);
        return {
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date,
          diff,
        };
      })
    );

    // Merge new commits with existing ones
    const updatedCommits = [...existingCommits, ...commitsWithDiffs];

    // Save the updated commits list back to the file
    await fs.promises.writeFile(outputPath, JSON.stringify(updatedCommits, null, 2));
    output.debug(`Added ${commitsWithDiffs.length} new commits to ${outputPath}`);

  } catch (err) {
    throw new Error(`Error fetching commits with diffs: ${err}`);
  }
}
