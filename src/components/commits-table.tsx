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

import { useState } from "react";
import { Clock, GitCommit, Hash, User, ChevronRightIcon, ChevronLeftIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface CommitsTableProps {
    commits: {
        hash: string;
        summary: string;
        message: string;
        author: string;
        date: string;
    }[];
}

const ITEMS_PER_PAGE = 10;

export default function CommitsTable({ commits }: CommitsTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(commits.length / ITEMS_PER_PAGE);

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentCommits = commits.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
    };

    const getPaginationItems = (currentPage: number, totalPages: number): (number | "...")[] => {
        const pages = new Set<number>();
        pages.add(1);
        pages.add(totalPages);
        pages.add(currentPage);

        if (currentPage > 1) pages.add(currentPage - 1);
        if (currentPage < totalPages) pages.add(currentPage + 1);

        const sortedPages = Array.from(pages).sort((a, b) => a - b);

        const result: (number | "...")[] = [];
        let prev = 0;

        for (let page of sortedPages) {
            if (prev && page - prev > 1) {
                result.push("...");
            }
            result.push(page);
            prev = page;
        }

        return result;
    };

    return (
        <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg">
            <div className="p-4 border-b border-gh-border-default flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <GitCommit className="h-4 w-4 text-gh-success-fg" />
                    <span className="font-semibold text-sm text-gh-fg-default">Recent Commits</span>
                </div>
                <span className="text-xs text-gh-fg-muted bg-gh-canvas-inset px-2 py-1 rounded-full">
                    {commits.length} total
                </span>
            </div>

            <Table>
                <TableHeader>
                    <TableRow className="border-b border-gh-border-default hover:bg-gh-canvas-inset">
                        <TableHead className="font-semibold text-xs text-gh-fg-muted">
                            <div className="flex items-center space-x-2">
                                <Hash className="h-3 w-3" />
                                <span>Hash</span>
                            </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-gh-fg-muted">Summary</TableHead>
                        <TableHead className="font-semibold text-xs text-gh-fg-muted">
                            <div className="flex items-center space-x-2">
                                <User className="h-3 w-3" />
                                <span>Author</span>
                            </div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-gh-fg-muted">
                            <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3" />
                                <span>Date</span>
                            </div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentCommits.map((commit) => (
                        <TableRow
                            key={commit.hash}
                            className="border-b border-gh-border-default hover:bg-gh-canvas-inset transition-colors"
                        >
                            <TableCell>
                                <code
                                    title={"Click to copy commit hash: " + commit.hash}
                                    onClick={() => navigator.clipboard.writeText(commit.hash)}
                                    className="text-xs bg-gh-canvas-inset cursor-pointer text-gh-accent-fg px-2 py-1 rounded font-mono">
                                    {commit.hash.slice(0, 7)}
                                </code>
                            </TableCell>
                            <TableCell className="max-w-md">
                                <div className="truncate text-sm text-gh-fg-default" title={commit.summary || commit.message}>{commit.summary || commit.message}</div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                        style={{
                                            background: `linear-gradient(to right, var(--gh-accent-emphasis), var(--gh-done-emphasis))`,
                                        }}
                                    >
                                        {commit.author.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-gh-fg-default">@{commit.author}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-xs text-gh-fg-muted">
                                {new Date(commit.date).toLocaleString()}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Pagination controls */}
            <div className="flex justify-center items-center space-x-3 p-4 border-t border-gh-border-default">
                <button
                    className="px-3 py-1 rounded border cursor-pointer border-gh-border-default text-sm disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                >
                    <ChevronLeftIcon className="h-5 w-4" />
                </button>

                {/* Clean pagination rendering */}
                {getPaginationItems(currentPage, totalPages).map((item, idx) =>
                    item === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">...</span>
                    ) : (
                        <button
                            key={item}
                            className={`px-3 py-1 rounded border cursor-pointer border-gh-border-default text-sm ${currentPage === item ? "bg-gh-canvas-inset font-semibold" : ""}`}
                            onClick={() => goToPage(item)}
                        >
                            {item}
                        </button>
                    )
                )}

                <button
                    className="px-3 py-1 rounded border cursor-pointer border-gh-border-default text-sm disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                >
                    <ChevronRightIcon className="h-5 w-4" />
                </button>
            </div>
        </div>
    );
}
