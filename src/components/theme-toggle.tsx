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

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

type Theme = "light" | "dark"

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Get saved theme or default to light
    const savedTheme = (localStorage.getItem("theme") as Theme) || "light"
    setTheme(savedTheme)

    // Apply theme class
    document.documentElement.classList.toggle("dark", savedTheme === "dark")

    // Add/remove transition class for smooth effect
    document.documentElement.classList.add("theme-transitioning")
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning")
    }, 100)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    localStorage.setItem("theme", nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
  }

  if (!mounted) {
    return <div className="w-9 h-9 bg-gh-canvas-subtle border border-gh-border-default rounded-md animate-pulse" />
  }

  const Icon = theme === "light" ? Sun : Moon
  const tooltipText = theme === "light" ? "Switch to dark mode" : "Switch to light mode"

  return (
    <button
      onClick={toggleTheme}
      className="relative cursor-pointer w-9 h-9 bg-gh-canvas-default hover:bg-gh-canvas-subtle border border-gh-border-default rounded-md transition-all duration-200 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-gh-accent-emphasis focus:ring-offset-2 focus:ring-offset-gh-canvas-default"
      aria-label={tooltipText}
      title={tooltipText}
    >
      <div className="relative w-4 h-4">
        <Icon
          className={`w-4 h-4 transition-all duration-300 ${theme === "light" ? "text-gh-attention-emphasis" : "text-gh-accent-fg"
            }`}
        />
      </div>

      {/* Theme indicator dot */}
      <div
        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gh-canvas-default transition-all duration-200 ${theme === "dark" ? "bg-gh-accent-fg" : "bg-gh-attention-emphasis"
          }`}
      />

      {/* Tooltip */}
      <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-gh-canvas-overlay border border-gh-border-default text-gh-fg-default text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {tooltipText}
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gh-canvas-overlay border-l border-t border-gh-border-default rotate-45"></div>
      </div>
    </button>
  )
}
