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

import path from "path";
import fs from "fs";

const sessionsDir = path.resolve(process.cwd(), ".git/gittyx_sessions");

export function ensureSessionDirExists() {
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
}

export function getSessionFilePath(sessionId: string): string {
    return path.join(sessionsDir, `${sessionId}.json`);
}

export function loadSessionHistory(sessionId: string): { role: "user" | "model"; text: string }[] {
    ensureSessionDirExists();
    const filePath = getSessionFilePath(sessionId);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
        return [];
    }
}

export function saveSessionHistory(sessionId: string, history: { role: "user" | "model"; text: string }[]) {
    ensureSessionDirExists();
    fs.writeFileSync(getSessionFilePath(sessionId), JSON.stringify(history, null, 2));
}

export function listSessionIds(): string[] {
    ensureSessionDirExists();
    return fs.readdirSync(sessionsDir)
        .filter(name => name.endsWith('.json'))
        .map(name => path.basename(name, '.json'));
}
