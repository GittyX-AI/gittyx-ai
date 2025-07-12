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
const git = simpleGit();

import { Tool, ToolInput } from './types';
import { logging } from '../utils/logging';
import { getCommits } from '../utils/insight';

export const getFirstCommit: Tool = {
    name: 'getFirstCommit',
    description: 'Returns the first commit in the repo.',
    async run() {
        const firstHash = (await git.raw(['rev-list', '--max-parents=0', 'HEAD'])).trim();
        const show = await git.show([firstHash, '--quiet']);
        return `First commit:\n${show.trim()}`;
    }
};

export const getLastCommit: Tool = {
    name: 'getLastCommit',
    description: 'Returns the most recent commit in the repo.',
    async run() {
        const log = await git.log({ maxCount: 1 });
        const last = log.all[0];
        return `Last commit:\n${last.date} by ${last.author_name}\n${last.message}`;
    }
};

export const getFirstLastCommit: Tool = {
    name: 'getFirstLastCommit',
    description: 'Returns the most recent and first commits in the repo.',
    async run() {
        const log = await git.log({ maxCount: 1 });
        const last = log.all[0];
        const firstHash = (await git.raw(['rev-list', '--max-parents=0', 'HEAD'])).trim();
        const show = await git.show([firstHash, '--quiet']);
        return `First commit:\n${show.trim()}\nLast commit:\n${last.date} by ${last.author_name}\n${last.message}`;
    }
};

export const listContributors: Tool = {
    name: 'listContributors',
    description: 'Lists all contributors and their commit counts.',
    async run() {
        try {
            const log = await git.log();
            const contributors = new Map<string, number>();

            for (const commit of log.all) {
                const author = `${commit.author_name} <${commit.author_email}>`;
                contributors.set(author, (contributors.get(author) || 0) + 1);
            }

            if (contributors.size === 0) {
                return 'No contributors found.';
            }

            const summary = Array.from(contributors.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by commit count desc
                .map(([author, count]) => `${count} commits by ${author}`)
                .join('\n');

            return `Contributors:\n${summary}`;
        } catch (err) {
            return `Error getting contributors: ${(err as Error).message}`;
        }
    }
};

export const getCommitByKeyword: Tool = {
    name: 'getCommitByKeyword',
    description: 'Find commits containing a specific keyword (this keyword must be in the commit message). Args: keyword',
    async run({ keyword }: ToolInput) {
        const log = await git.log();
        const matches = log.all.filter(c => c.message.includes(keyword));
        logging(`Found ${matches.length} commits with keyword: ${keyword}`, "debug");
        if (!matches.length) return `No commits found with keyword: ${keyword}`;
        return matches.map(c => `- ${c.date} ${c.hash.slice(0, 7)}: ${c.message}`).join('\n');
    }
};

export const getCommitDetails: Tool = {
    name: 'getCommitDetails',
    description: 'Get details of a specific commit by its hash. Args: hash',
    async run({ hash }: ToolInput) {
        try {
            const show = await git.show([hash, '--quiet']);
            if (!show) {
                return `No commit found with hash: ${hash}`;
            }
            return `Commit details for ${hash}:\n${show.trim()}`;
        } catch (err) {
            return `Error fetching commit details: ${(err as Error).message}`;
        }
    }
};

export async function getTrackedFiles(): Promise<string[]> {
    const files = await git.raw(['ls-files']);
    return files.split('\n').filter(f => f.trim() !== '');
}

export const summarizeFileEvolution: Tool = {
    name: 'summarizeFileEvolution',
    description: 'Summarize changes to a file over time. Args: file',
    async run({ file }: ToolInput) {
        // remove the first / if it exists
        if (file.startsWith('/')) {
            file = file.slice(1);
        }

        logging(`Fetching changes for file: ${file}`, "debug");

        // Use raw git log to avoid argument issues
        let logOutput: string;
        try {
            logOutput = await git.raw([
                'log',
                '--pretty=format:%H|%an|%ad|%s',
                '--date=short',
                '--',
                file
            ]);
        } catch (error) {
            logging(`Git log failed for file: ${file}`, "error");
            return `Failed to get git log for ${file}`;
        }

        if (!logOutput.trim()) {
            logging(`No changes found for file: ${file}`, "error");
            return `No changes found for file: ${file}`;
        }

        // Parse log output
        const commits = logOutput.trim().split('\n').map(line => {
            const [hash, author_name, date, message] = line.split('|');
            return { hash, author_name, date, message };
        });

        let summary = `File diff evolution for ${file}:\n`;

        // Iterate over commit pairs to get diffs
        for (let i = 0; i < commits.length - 1; i++) {
            const newer = commits[i].hash;
            const older = commits[i + 1].hash;

            let diff: string;
            try {
                diff = await git.diff([`${older}..${newer}`, '--', file]);
            } catch (error) {
                logging(`Failed to get diff between ${older} and ${newer}`, "error");
                continue;
            }

            const added = (diff.match(/^\+(?!\+\+)/gm) || []).length;
            const removed = (diff.match(/^\-(?!--)/gm) || []).length;

            summary += `\nCommit ${newer} by ${commits[i].author_name} on ${commits[i].date}:\n`;
            summary += `Message: ${commits[i].message}\n`;
            summary += `Lines added: ${added}, lines removed: ${removed}\n`;
            summary += `Diff:\n${diff.trim()}\n`;
        }

        logging(summary, "debug");
        return summary;
    }
};

export const getCommitStats: Tool = {
    name: 'getCommitStats',
    description: 'Show number of commits, contributors, and commit burst.',
    async run() {
        const log = await git.log();
        const total = log.all.length;
        const authors = new Set(log.all.map(c => c.author_email));
        const burst = log.all.reduce((acc, cur) => {
            const date = cur.date.split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const peakDay = Object.entries(burst).sort(((a: [string, number], b: [string, number]) => b[1] - a[1]))[0];
        return `Total commits: ${total}\nContributors: ${authors.size}\nBusiest day: ${peakDay[0]} (${peakDay[1]} commits)`;
    }
};

export const summarizeRepo: Tool = {
    name: 'summarizeRepo',
    description: 'Summarize the repository including first/last commits, contributors, commit stats and summarize of all commits.',
    async run({ limit }: ToolInput) {
        const firstCommit = await getFirstCommit.run({});
        const lastCommit = await getLastCommit.run({});
        const contributors = await listContributors.run({});
        const commitStats = await getCommitStats.run({});
        const commitsSummaries = getCommits(limit).map(c => `- ${c.date} ${c.hash.slice(0, 7)}: ${c.message}. ${c.summary}`).join('\n');
        const summary = `Repository Summary:\n\n${firstCommit}\n\n${lastCommit}\n\n${contributors}\n\n${commitStats}\n\nCommits:\n${commitsSummaries}`;

        logging(summary, "debug");
        return summary;
    }
};

export const tools: Record<string, Tool> = {
    getFirstCommit,
    getLastCommit,
    getFirstLastCommit,
    listContributors,
    getCommitByKeyword,
    getCommitDetails,
    summarizeFileEvolution,
    getCommitStats,
    summarizeRepo
};
