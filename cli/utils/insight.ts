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

import fs from 'fs';
import path from 'path';
import { logging } from './logging';
const cachePath = path.resolve(process.cwd(), '.git/gittyx.json');

function loadCache(): any[] {
    if (!fs.existsSync(cachePath)) return [];

    const raw = fs.readFileSync(cachePath, 'utf-8');

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        logging(`Could not parse cache file:${e}`, "warn");
        return [];
    }
}

export function getOverallSummary(): string {
    const cache = loadCache();
    const entry = cache.find((c) => c.hash === '__overall__');
    return entry?.summary || 'No overall summary available.';
}

export function getTimelineChartConfig(): any | null {
    const cache = loadCache();
    const chartEntry = cache.find((c) => c.hash === '__chart__');
    return chartEntry?.config || null;
}

export function getCommits(limit: number): any[] {
    const cache = loadCache();
    const commits = cache
        .filter((c) => c.hash !== "__overall__" && c.hash !== "__chart__")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // sort by date descending
    // if limit is specified, return only the latest commits
    if (limit && limit > 0) {
        const sortedCommits = commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sortedCommits.slice(0, limit);
    }

    return commits;
}

