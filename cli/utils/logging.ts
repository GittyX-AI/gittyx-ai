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

type LogType = 'info' | 'error' | 'warn' | 'debug';

export function logging(message: string, type: LogType = "info") {
    const colors = {
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        red: "\x1b[31m",
    };

    const typeColors = {
        info: colors.cyan,
        error: colors.red,
        warn: colors.yellow,
        debug: colors.magenta,
    };

    const color = typeColors[type] || colors.green;

    console.log(`${colors.bright}${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}


export function asciiArtBanner(port: number | string) {
    const colors = {
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
    }

    console.log("\n")
    console.log(`${colors.cyan}${colors.bright}`)
    console.log("  ██████╗ ██╗████████╗████████╗██╗   ██╗██╗  ██╗")
    console.log("  ██╔════╝ ██║╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝╚██╗██╔╝")
    console.log("  ██║  ███╗██║   ██║      ██║    ╚████╔╝  ╚███╔╝ ")
    console.log("  ██║   ██║██║   ██║      ██║     ╚██╔╝   ██╔██╗ ")
    console.log("  ╚██████╔╝██║   ██║      ██║      ██║   ██╔╝ ██╗")
    console.log("   ╚═════╝ ╚═╝   ╚═╝      ╚═╝      ╚═╝   ╚═╝  ╚═╝")
    console.log(`${colors.reset}`)
    console.log(`${colors.magenta}                    D A S H B O A R D${colors.reset}`)
    console.log("\n")
    console.log(
        `${colors.green}  Server running on: ${colors.bright}${colors.blue}http://localhost:${port}${colors.reset}`,
    )
    console.log(`${colors.cyan}  Dashboard interface loaded${colors.reset}`)
    console.log("\n")
}

