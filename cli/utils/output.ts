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

/**
 * Professional output manager for GittyX CLI
 * Handles verbose, quiet, and normal output modes with clean formatting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface OutputOptions {
  verbose: boolean;
  quiet: boolean;
}

class OutputManager {
  private verbose: boolean;
  private quiet: boolean;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;

  constructor(options: OutputOptions = { verbose: false, quiet: false }) {
    this.verbose = options.verbose;
    this.quiet = options.quiet;
  }

  /**
   * Set verbosity level
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Set quiet mode (suppresses all output except final URL)
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  /**
   * Log a message based on current output settings
   * In normal mode: only shows info and above
   * In verbose mode: shows all levels with tags
   * In quiet mode: shows nothing except final URL
   */
  private log(message: string, level: LogLevel = 'info'): void {
    // Suppress all output in quiet mode
    if (this.quiet && level !== 'error') return;

    // In normal mode, only show info, warn, error (not debug)
    if (!this.verbose && level === 'debug') return;

    // Color codes for terminal output
    const colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      gray: '\x1b[90m',
    };

    let prefix = '';

    // Only add tags in verbose mode
    if (this.verbose) {
      switch (level) {
        case 'debug':
          prefix = `${colors.bright}${colors.gray}[DEBUG]${colors.reset} `;
          break;
        case 'info':
          prefix = `${colors.bright}${colors.cyan}[INFO]${colors.reset} `;
          break;
        case 'warn':
          prefix = `${colors.bright}${colors.yellow}[WARN]${colors.reset} `;
          break;
        case 'error':
          prefix = `${colors.bright}${colors.red}[ERROR]${colors.reset} `;
          break;
      }
    }

    console.log(`${prefix}${message}`);
  }

  /**
   * Output a debug message (verbose only)
   */
  debug(message: string): void {
    this.log(message, 'debug');
  }

  /**
   * Output an info message (normal and verbose)
   */
  info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * Output a warning (with clean formatting, no tag in normal mode)
   */
  warn(message: string): void {
    if (this.quiet) return;

    const colors = {
      yellow: '\x1b[33m',
      reset: '\x1b[0m',
    };

    console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
  }

  /**
   * Output an error (always shown unless quiet mode and not fatal)
   */
  error(message: string): void {
    const colors = {
      red: '\x1b[31m',
      reset: '\x1b[0m',
      bright: '\x1b[1m',
    };

    console.error(`${colors.bright}${colors.red}✗ ${message}${colors.reset}`);
  }

  /**
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    if (this.quiet) return;

    this.spinnerIndex = 0;
    process.stdout.write(`${this.spinnerChars[0]} ${message}`);

    this.spinnerInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerChars.length;
      process.stdout.write(`\r${this.spinnerChars[this.spinnerIndex]} ${message}`);
    }, 80);
  }

  /**
   * Stop the spinner and clear the line
   */
  stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      process.stdout.write('\r\x1b[K'); // Clear line
    }
  }

  /**
   * Display a clean summary table
   */
  showSummary(stats: {
    commits: number;
    files: number;
    timeTaken: string;
  }): void {
    if (this.quiet) return;

    const colors = {
      green: '\x1b[32m',
      reset: '\x1b[0m',
      bright: '\x1b[1m',
    };

    console.log(`\n${colors.bright}${colors.green}✓ GittyX analysis complete${colors.reset}\n`);
    console.log(`  Commits analysed   ${stats.commits}`);
    console.log(`  Files indexed      ${stats.files}`);
    console.log(`  Time taken         ${stats.timeTaken}\n`);
  }

  /**
   * Show the dashboard URL
   */
  showDashboardUrl(url: string): void {
    if (this.quiet) {
      // In quiet mode, only show the URL
      console.log(url);
      return;
    }

    const colors = {
      blue: '\x1b[34m',
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      cyan: '\x1b[36m',
    };

    console.log(`${colors.cyan}→ Dashboard: ${colors.bright}${colors.blue}${url}${colors.reset}`);
  }

  /**
   * Display the ASCII banner (only in normal/verbose mode)
   */
  showBanner(port: number | string): void {
    if (this.quiet) return;

    const colors = {
      cyan: '\x1b[36m',
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      magenta: '\x1b[35m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
    };

    console.log('\n');
    console.log(`${colors.cyan}${colors.bright}`);
    console.log('  ██████╗ ██╗████████╗████████╗██╗   ██╗██╗  ██╗');
    console.log('  ██╔════╝ ██║╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝╚██╗██╔╝');
    console.log('  ██║  ███╗██║   ██║      ██║    ╚████╔╝  ╚███╔╝ ');
    console.log('  ██║   ██║██║   ██║      ██║     ╚██╔╝   ██╔██╗ ');
    console.log('  ╚██████╔╝██║   ██║      ██║      ██║   ██╔╝ ██╗');
    console.log('   ╚═════╝ ╚═╝   ╚═╝      ╚═╝      ╚═╝   ╚═╝  ╚═╝');
    console.log(`${colors.reset}`);
    console.log(`${colors.magenta}                    D A S H B O A R D${colors.reset}`);
    console.log('\n');
    console.log(
      `${colors.green}  Server running on: ${colors.bright}${colors.blue}http://localhost:${port}${colors.reset}`,
    );
    console.log(`${colors.cyan}  Dashboard interface loaded${colors.reset}`);
    console.log('\n');
  }
}

// Global instance for easy access
export const output = new OutputManager();

export default OutputManager;
