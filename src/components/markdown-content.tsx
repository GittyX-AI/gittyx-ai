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


import type React from "react"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import rehypePrism from "rehype-prism-plus"
import { useState } from "react"
import { Check, Copy, ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import "katex/dist/katex.min.css"

interface MarkdownContentProps {
  content: string
  className?: string
  enableMath?: boolean
  enableCopyCode?: boolean
  enableLineNumbers?: boolean
}

// Advanced content preprocessing
const preprocessContent = (text: string) => {
  return (
    text
      // Convert bullet points to proper markdown
      .replace(/^([\s]*)•\s*/gm, "$1- ")
      .replace(/^([\s]*)◦\s*/gm, "$1  - ")
      .replace(/^([\s]*)▪\s*/gm, "$1    - ")

      // Handle numeric lists with proper spacing
      .replace(/^([\s]*)(\d+)\.\s*/gm, "$1$2. ")

      // Handle lettered lists
      .replace(/^([\s]*)([a-zA-Z])\.\s*/gm, "$1$2. ")

      // Convert common text patterns
      .replace(/\*\*(.*?)\*\*/g, "**$1**") // Bold
      .replace(/\*(.*?)\*/g, "*$1*") // Italic
      .replace(/`([^`]+)`/g, "`$1`") // Inline code

      // Handle collapsible sections
      .replace(/^<details>\s*<summary>(.*?)<\/summary>/gm, "%%COLLAPSIBLE_START%%$1%%COLLAPSIBLE_MIDDLE%%")
      .replace(/<\/details>/gm, "%%COLLAPSIBLE_END%%")

      // Clean up excessive whitespace
      .replace(/\n{4,}/g, "\n\n\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/^[ \t]+/gm, (match) => match.replace(/\t/g, "  "))

      .trim()
  )
}

// Copy to clipboard hook
const useCopyToClipboard = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return { copyToClipboard, copiedId }
}

// Collapsible section component
const CollapsibleSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-4 border border-gh-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gh-canvas-subtle hover:bg-gh-canvas-default transition-colors flex items-center gap-2 text-left font-medium text-gh-fg-default"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {isOpen && <div className="p-4 bg-gh-canvas-default">{children}</div>}
    </div>
  )
}

// Code block component with copy functionality
const CodeBlock = ({
  children,
  className,
  enableCopy = true,
  enableLineNumbers = false,
}: {
  children: string
  className?: string
  enableCopy?: boolean
  enableLineNumbers?: boolean
}) => {
  const { copyToClipboard, copiedId } = useCopyToClipboard()
  const codeId = Math.random().toString(36).substr(2, 9)
  const language = className?.replace("language-", "") || "text"
  const code = String(children).replace(/\n$/, "")

  const lines = code.split("\n")

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gh-canvas-subtle border border-gh-border-default rounded-t-lg">
        <span className="text-xs font-medium text-gh-fg-muted uppercase tracking-wide">{language}</span>
        {enableCopy && (
          <button
            onClick={() => copyToClipboard(code, codeId)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gh-canvas-default hover:bg-gh-canvas-inset border border-gh-border-default rounded transition-colors"
            title="Copy code"
          >
            {copiedId === codeId ? (
              <>
                <Check className="h-3 w-3 text-gh-success-fg" />
                <span className="text-gh-success-fg">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      <pre className="p-4 bg-gh-canvas-inset border-x border-b border-gh-border-default rounded-b-lg overflow-x-auto">
        <code className={className}>
          {enableLineNumbers ? (
            <div className="flex">
              <div className="select-none text-gh-fg-muted pr-4 text-right" style={{ minWidth: "2em" }}>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="flex-1">{children}</div>
            </div>
          ) : (
            children
          )}
        </code>
      </pre>
    </div>
  )
}

export function MarkdownContent({
  content,
  className = "",
  enableMath = true,
  enableCopyCode = true,
  enableLineNumbers = false,
}: MarkdownContentProps) {
  const processedContent = preprocessContent(content)

  // Handle collapsible sections
  const renderWithCollapsibles = (text: string) => {
    const parts = text.split(/%%COLLAPSIBLE_START%%(.*?)%%COLLAPSIBLE_MIDDLE%%(.*?)%%COLLAPSIBLE_END%%/gs)
    const result: React.ReactNode[] = []

    for (let i = 0; i < parts.length; i += 3) {
      if (parts[i]) {
        result.push(
          <ReactMarkdown
            key={`text-${i}`}
            remarkPlugins={enableMath ? [remarkGfm, remarkMath] : [remarkGfm]}
            rehypePlugins={
              enableMath
                ? [rehypeRaw, rehypeSanitize, rehypePrism, rehypeKatex]
                : [rehypeRaw, rehypeSanitize, rehypePrism]
            }
            components={components}
          >
            {parts[i]}
          </ReactMarkdown>,
        )
      }

      if (parts[i + 1] && parts[i + 2]) {
        result.push(
          <CollapsibleSection key={`collapsible-${i}`} title={parts[i + 1]}>
            <ReactMarkdown
              remarkPlugins={enableMath ? [remarkGfm, remarkMath] : [remarkGfm]}
              rehypePlugins={
                enableMath
                  ? [rehypeRaw, rehypeSanitize, rehypePrism, rehypeKatex]
                  : [rehypeRaw, rehypeSanitize, rehypePrism]
              }
              components={components}
            >
              {parts[i + 2]}
            </ReactMarkdown>
          </CollapsibleSection>,
        )
      }
    }

    return result.length > 1 ? <>{result}</> : result[0]
  }

  const components: Components = {
    // Headings with anchor links
    h1: ({ children, id }) => (
      <h1 id={id} className="text-2xl font-bold mt-8 mb-4 text-gh-fg-default border-b border-gh-border-default pb-2">
        {children}
      </h1>
    ),
    h2: ({ children, id }) => (
      <h2 id={id} className="text-xl font-bold mt-6 mb-3 text-gh-fg-default">
        {children}
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="text-lg font-semibold mt-5 mb-2 text-gh-fg-default">
        {children}
      </h3>
    ),
    h4: ({ children, id }) => (
      <h4 id={id} className="text-base font-semibold mt-4 mb-2 text-gh-fg-default">
        {children}
      </h4>
    ),

    // Paragraphs with proper spacing
    p: ({ children }) => <p className="mb-4 leading-relaxed text-gh-fg-default">{children}</p>,

    // Enhanced links
    a: ({ children, href, title }) => {
      const isExternal = href?.startsWith("http")
      return (
        <a
          href={href}
          title={title}
          className="text-gh-accent-fg hover:text-gh-accent-emphasis underline underline-offset-2 decoration-1 hover:decoration-2 transition-all inline-flex items-center gap-1"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {children}
          {isExternal && <ExternalLink className="h-3 w-3" />}
        </a>
      )
    },

    // Code blocks with enhanced features
    pre: ({ children }) => {
      const child = children as any
      const code = child?.props?.children || ""
      const className = child?.props?.className || ""

      return (
        <CodeBlock className={className} enableCopy={enableCopyCode} enableLineNumbers={enableLineNumbers}>
          {code}
        </CodeBlock>
      )
    },

    // Inline code
    code: ({ children, className }) => {
      const isInline = !className
      return isInline ? (
        <code className="bg-gh-canvas-inset px-1.5 py-0.5 rounded text-sm border border-gh-border-default font-mono">
          {children}
        </code>
      ) : (
        <code className={className}>{children}</code>
      )
    },

    // Enhanced lists
    ul: ({ children }) => <ul className="list-disc pl-6 my-4 space-y-1 text-gh-fg-default">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 my-4 space-y-1 text-gh-fg-default">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,

    // Task lists (GitHub style)
    input: ({ type, checked, disabled }) => {
      if (type === "checkbox") {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="mr-2 rounded border-gh-border-default"
            readOnly
          />
        )
      }
      return <input type={type} checked={checked} disabled={disabled} />
    },

    // Enhanced blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gh-accent-emphasis bg-gh-canvas-subtle pl-4 py-2 my-4 italic">
        <div className="text-gh-fg-muted">{children}</div>
      </blockquote>
    ),

    // Tables with GitHub styling
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 border border-gh-border-default rounded-lg">
        <table className="min-w-full divide-y divide-gh-border-default">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-gh-canvas-subtle">{children}</thead>,
    tbody: ({ children }) => (
      <tbody className="bg-gh-canvas-default divide-y divide-gh-border-default">{children}</tbody>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gh-fg-default uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="px-4 py-3 text-sm text-gh-fg-default">{children}</td>,

    // Horizontal rule
    hr: () => <hr className="my-8 border-gh-border-default" />,

    // Images with proper styling
    img: ({ src, alt, title }) => (
      <div className="my-4">
        <img
          src={src || "/placeholder.svg"}
          alt={alt}
          title={title}
          className="max-w-full h-auto rounded-lg border border-gh-border-default shadow-sm"
          loading="lazy"
        />
        {alt && <p className="text-sm text-gh-fg-muted text-center mt-2 italic">{alt}</p>}
      </div>
    ),

    // Keyboard keys
    kbd: ({ children }) => (
      <kbd className="px-2 py-1 text-xs font-semibold text-gh-fg-default bg-gh-canvas-subtle border border-gh-border-default rounded shadow-sm">
        {children}
      </kbd>
    ),
  }

  // Check if content has collapsible sections
  const hasCollapsibles = processedContent.includes("%%COLLAPSIBLE_START%%")

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {hasCollapsibles ? (
        renderWithCollapsibles(processedContent)
      ) : (
        <ReactMarkdown
          remarkPlugins={enableMath ? [remarkGfm, remarkMath] : [remarkGfm]}
          rehypePlugins={
            enableMath
              ? [rehypeRaw, rehypeSanitize, rehypePrism, rehypeKatex]
              : [rehypeRaw, rehypeSanitize, rehypePrism]
          }
          components={components}
        >
          {processedContent}
        </ReactMarkdown>
      )}
    </div>
  )
}
