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

import { ScrollArea } from "@/components/ui/scroll-area"
import Chart from "chart.js/auto"
import { useEffect, useRef, useState } from "react"
import {
    GitCommit,
    TrendingUp,
    Users,
    Calendar,
} from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { MarkdownContent } from "./markdown-content"
import CommitsTable from "./commits-table"
import ChatBox from "./chat-box"

type Commit = {
    hash: string
    message: string
    date: string
    author: string
    summary: string
    [key: string]: any
}

type InsightData = {
    summary: string
    chartConfig: any
    commits: Commit[]
}

export default function Dashboard() {
    const [data, setData] = useState<InsightData | null>(null)
    const chartRef = useRef<HTMLCanvasElement>(null)
    const chartInstance = useRef<Chart | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/insights")
                const result = await response.json()
                setData(result)
            } catch (error) {
                console.error("Failed to fetch data:", error)
            }
        }

        fetchData()
    }, [])

    const chartConfig = data?.chartConfig
    const overallSummary = data?.summary
    const commits = data?.commits || []

    useEffect(() => {
        if (chartRef.current && chartConfig) {
            // Destroy existing chart instance
            if (chartInstance.current) {
                chartInstance.current.destroy()
            }

            chartInstance.current = new Chart(chartRef.current, chartConfig)
        }

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy()
            }
        }
    }, [chartConfig])


    if (!data) {
        return (
            <div className="min-h-screen bg-gh-canvas-default">
                <div className="flex items-center justify-center h-screen w-full">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gh-border-default"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gh-accent-emphasis border-t-transparent absolute top-0 left-0"></div>
                        </div>
                        <p className="font-medium text-gh-fg-muted">Loading dashboard...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gh-canvas-inset">
            {/* Header */}
            <div className="bg-gh-canvas-default border-b border-gh-border-default sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-3">

                        <img src="/logo.png" alt="GittyX Logo" className="h-12 w-12 rounded-xl" />

                        <div>
                            <h1 className="text-2xl font-bold text-gh-fg-default">GittyX AI</h1>
                            <p className="text-gh-fg-muted">Easy way to understand your next big project.</p>
                        </div>
                        <div className="flex cursor-pointer items-center ml-auto justify-end">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <ChatBox />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gh-fg-muted uppercase tracking-wide">Total Commits</p>
                                <p className="text-2xl font-bold text-gh-fg-default mt-1">{commits.length}</p>
                            </div>
                            <div className="p-2 bg-gh-accent-subtle rounded-lg">
                                <GitCommit className="h-5 w-5 text-gh-accent-fg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gh-fg-muted uppercase tracking-wide">Contributors</p>
                                <p className="text-2xl font-bold text-gh-fg-default mt-1">
                                    {new Set(commits.map((c) => c.author)).size}
                                </p>
                            </div>
                            <div className="p-2 bg-gh-success-subtle rounded-lg">
                                <Users className="h-5 w-5 text-gh-success-fg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gh-fg-muted uppercase tracking-wide">Latest Activity</p>
                                <p className="text-lg font-semibold text-gh-fg-default mt-1">
                                    {commits.length > 0 ? new Date(commits[0].date).toLocaleDateString() : "N/A"}
                                </p>
                            </div>
                            <div className="p-2 bg-gh-attention-subtle rounded-lg">
                                <Calendar className="h-5 w-5 text-gh-done-fg" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Chart Section */}
                    <div className="xl:col-span-2">
                        <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg">
                            <div className="p-4 border-b border-gh-border-default">
                                <div className="flex items-center space-x-2">
                                    <TrendingUp className="h-4 w-4 text-gh-accent-fg" />
                                    <span className="font-semibold text-sm text-gh-fg-default">Commit Timeline</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="bg-gh-canvas-inset rounded-lg p-4">
                                    <canvas ref={chartRef} className="max-h-80" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div>
                        <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg h-fit">
                            <div className="p-4 border-b border-gh-border-default">
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="p-1 rounded"
                                        style={{
                                            background: `linear-gradient(to right, var(--gh-accent-emphasis), var(--gh-done-emphasis))`,
                                        }}
                                    >
                                        <TrendingUp className="h-3 w-3 text-white" />
                                    </div>
                                    <span className="font-semibold text-sm text-gh-fg-default">Project Summary</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <ScrollArea className="h-90 p-1">
                                    <div className="prose prose-sm max-w-none text-sm text-justify text-gh-fg-default leading-relaxed whitespace-pre-line">
                                        <MarkdownContent content={overallSummary || ""} enableCopyCode={true} enableMath={true} />
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Commits Table */}
                <CommitsTable commits={commits} />
            </div>
        </div>
    )
}
