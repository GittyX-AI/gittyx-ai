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
import { useEffect, useRef, useState } from "react"
import {
  Send,
  MessageSquare,
  User,
  Bot,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { MarkdownContent } from "./markdown-content"
import { ScrollArea } from "./ui/scroll-area"

type Message = {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
}

type Session = {
  id: string
  title: string
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

export default function ChatBox() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [query, setQuery] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState("")
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isConversationVisible, setIsConversationVisible] = useState(true)
  const [isSessionsVisible, setIsSessionsVisible] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  const chatRef = useRef<HTMLDivElement>(null)

  // Load sessions from API
  const loadSessions = async () => {
    setIsLoadingSessions(true)
    try {
      const response = await fetch("/api/sessions")
      if (response.ok) {
        const sessionsData = await response.json()
        const parsedSessions = sessionsData.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }))
        setSessions(parsedSessions)
        setSessionsLoaded(true)
      }
    } catch (error) {
      console.error("Failed to load sessions:", error)
      setSessionsLoaded(true) // Still mark as loaded even on error
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // Load messages for a specific session
  const loadSessionMessages = async (sessionId: string) => {
    setIsLoadingMessages(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        const parsedMessages = data.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }))
        setMessages(parsedMessages)
        setHasSubmitted(parsedMessages.length > 0)
      }
    } catch (error) {
      console.error("Failed to load session messages:", error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  // Load messages when current session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId)
    } else {
      setMessages([])
      setHasSubmitted(false)
    }
  }, [currentSessionId])

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:49251")
    setSocket(ws)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === "session") {
        console.log("Received session ID:", data.sessionId)
        setCurrentSessionId(data.sessionId)
        loadSessions()
      } else if (data.type === "response") {
        setCurrentResponse((prev) => prev + data.text)
      } else if (data.type === "done") {
        setIsStreaming(false)
        setCurrentResponse((finalResponse) => {
          if (finalResponse) {
            const aiMessage: Message = {
              id: Date.now().toString(),
              type: "ai",
              content: finalResponse,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, aiMessage])
            loadSessions()
          }
          return ""
        })
      } else if (data.type === "error") {
        setIsStreaming(false)
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: "ai",
          content: `Error: ${data.error}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
        setCurrentResponse("")
      }
    }

    ws.onopen = () => console.log("✅ WebSocket connected")
    ws.onclose = () => console.log("🔌 WebSocket disconnected")

    return () => ws.close()
  }, [])

  const createNewSession = () => {
    setCurrentSessionId(null)
    setMessages([])
    setHasSubmitted(false)
    setIsConversationVisible(true)
    setIsSessionsVisible(false)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null)
          setMessages([])
          setHasSubmitted(false)
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }

  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setIsSessionsVisible(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !socket || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setCurrentResponse("")
    setIsStreaming(true)
    setHasSubmitted(true)
    setIsConversationVisible(true)

    socket.send(
      JSON.stringify({
        query,
        sessionId: currentSessionId,
      }),
    )

    setQuery("")
  }

  useEffect(() => {
    const chatEl = chatRef.current;
    if (!chatEl) return;

    // How close the scroll should be to the bottom to consider "at bottom"
    const isNearBottom =
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 50;

    if (isNearBottom) {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }, [messages, currentResponse]);

  const UserMessage = ({ message }: { message: Message }) => {
    scrollToBottom()
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-gh-accent-emphasis text-gh-fg-on-emphasis rounded-lg px-4 py-2 max-w-full mt-4">
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="p-1 bg-gh-accent-subtle rounded-full flex-shrink-0">
            <User className="h-4 w-4 text-gh-accent-fg" />
          </div>
        </div>
      </div>
    )
  }

  const AIMessage = ({ message }: { message: Message }) => {
    scrollToBottom()
    return (
      <div className="flex justify-start mb-4">
        <div className="flex items-start space-x-3 max-w-[90%]">
          <div className="p-1 bg-gh-success-subtle rounded-full flex-shrink-0 mt-1">
            <Bot className="h-4 w-4 text-gh-success-fg" />
          </div>
          <div className="text-sm text-gh-fg-default leading-relaxed mt-4">
            <MarkdownContent content={message.content} enableCopyCode={true} enableMath={true} />
          </div>
        </div>
      </div>
    )
  }

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }

  const StreamingMessage = () => (
    <div className="flex justify-start mb-4">
      <div className="flex items-start space-x-3 max-w-[90%]">
        <div className="p-1 bg-gh-success-subtle rounded-full flex-shrink-0 mt-1">
          <Bot className="h-4 w-4 text-gh-success-fg" />
        </div>
        <div className="text-sm text-gh-fg-default leading-relaxed mt-4">
          {currentResponse ? (
            <MarkdownContent content={currentResponse} enableCopyCode={true} enableMath={true} />
          ) : (
            <div className="flex items-center gap-2 text-gh-fg-muted">
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  // Show conversation area if sessions have been loaded (regardless of whether there are any)
  const shouldShowConversationArea = sessionsLoaded

  return (
    <div className="w-full">
      {/* AI Assistant Header */}
      <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg mb-4">
        <div className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-4 py-3 pr-12 text-gh-fg-default placeholder-gh-fg-muted bg-gh-canvas-inset border border-gh-border-default rounded-md focus:outline-none focus:ring-2 focus:ring-gh-accent-emphasis focus:border-gh-accent-emphasis transition-all duration-200"
                placeholder="Ask something about the code or repo..."
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!query.trim() || isStreaming}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gh-success-emphasis text-gh-fg-on-emphasis rounded-md hover:bg-gh-success-emphasis/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Conversation Area - Show after sessions are loaded */}
      {shouldShowConversationArea && (
        <div className="bg-gh-canvas-default border border-gh-border-default rounded-lg hover:shadow-md transition-shadow">
          <div className="p-4 border-b border-gh-border-default">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {sessions.length > 0 && (
                  <button
                    onClick={() => {
                      setIsSessionsVisible(!isSessionsVisible)
                      setIsConversationVisible(true)
                    }}
                    className="p-1 text-gh-fg-muted cursor-pointer hover:text-gh-fg-default hover:bg-gh-canvas-subtle rounded transition-colors"
                    title="Toggle sessions"
                  >
                    {isSessionsVisible ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                )}
                {!currentSession ? (
                  <>
                    <div className="p-1 bg-gh-success-subtle rounded">
                      <MessageSquare className="h-3 w-3 text-gh-success-fg" />
                    </div>
                    <span className="font-semibold text-sm text-gh-fg-default">Conversation</span>
                  </>
                ) : (
                  <>
                    <div className="p-1 bg-gh-success-subtle rounded">
                      <MessageSquare className="h-3 w-3 text-gh-success-fg" />
                    </div>
                    <span className="font-semibold text-sm text-gh-fg-default">{currentSession.title}</span>
                  </>
                )}
                {isLoadingMessages && <RefreshCw className="h-3 w-3 animate-spin text-gh-fg-muted" />}
              </div>

              {/* Only show collapse/expand button if there are messages to show OR if we're in a session */}
              {(hasSubmitted || messages.length > 0 || currentSession) && (
                <button
                  onClick={() => setIsConversationVisible(!isConversationVisible)}
                  className="p-1 text-gh-fg-muted hover:text-gh-fg-default cursor-pointer hover:bg-gh-canvas-subtle rounded transition-colors duration-200"
                  title={isConversationVisible ? "Hide conversation" : "Show conversation"}
                >
                  {isConversationVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Chat Content Area - Always show when conversation area is visible */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${isConversationVisible ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="bg-gh-canvas-inset">
              <div className="flex">
                {/* Compact Sessions Sidebar */}
                <div
                  className={`transition-all duration-300 ease-in-out border-r border-gh-border-default bg-gh-canvas-default ${isSessionsVisible ? "w-64 opacity-100" : "w-0 opacity-0"
                    } overflow-hidden flex-shrink-0`}
                >
                  <div className="h-80 flex flex-col w-64">
                    <div className="p-3 border-b border-gh-border-default flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-gh-fg-default uppercase tracking-wide">Sessions</h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={loadSessions}
                            disabled={isLoadingSessions}
                            className="p-1 text-gh-fg-muted cursor-pointer hover:text-gh-fg-default hover:bg-gh-canvas-subtle rounded transition-colors disabled:opacity-50"
                            title="Refresh sessions"
                          >
                            <RefreshCw className={`h-3 w-3 ${isLoadingSessions ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            onClick={createNewSession}
                            className="p-1 text-gh-fg-muted cursor-pointer hover:text-gh-fg-default hover:bg-gh-canvas-subtle rounded transition-colors"
                            title="New conversation"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <ScrollArea className="h-70">
                      <div className="p-2">
                        {isLoadingSessions ? (
                          <div className="text-center py-4">
                            <RefreshCw className="h-4 w-4 animate-spin mx-auto text-gh-fg-muted" />
                            <p className="text-xs text-gh-fg-muted mt-1">Loading...</p>
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="text-center py-4 text-gh-fg-muted">
                            <p className="text-xs">No sessions yet</p>
                            <button
                              onClick={createNewSession}
                              className="mt-2 px-2 py-1 text-xs bg-gh-accent-emphasis text-gh-fg-on-emphasis rounded hover:bg-gh-accent-emphasis/90 transition-colors"
                            >
                              Start New Chat
                            </button>
                          </div>
                        ) : (
                          sessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => selectSession(session.id)}
                              className={`relative block w-full p-2 rounded mb-1 cursor-pointer transition-colors group text-xs ${currentSessionId === session.id
                                  ? "bg-gh-accent-subtle border border-gh-accent-emphasis"
                                  : "hover:bg-gh-canvas-subtle border border-transparent"
                                }`}
                            >
                              {/* Content container with explicit width constraints */}
                              <div className="flex items-start w-full">
                                {/* Text content - fixed width to prevent overflow */}
                                <div className="w-44 min-w-0">
                                  <p
                                    className="font-medium text-gh-fg-default text-xs truncate w-full"
                                    style={{ maxWidth: "176px" }}
                                  >
                                    {session.title}
                                  </p>
                                  <p className="text-xs text-gh-fg-muted truncate w-full" style={{ maxWidth: "176px" }}>
                                    {session.messageCount} msgs
                                  </p>
                                  <p className="text-xs text-gh-fg-muted truncate w-full" style={{ maxWidth: "176px" }}>
                                    {session.updatedAt.toLocaleDateString()}
                                  </p>
                                </div>

                                {/* Trash button - fixed position */}
                                <div className="w-6 h-6 flex items-center justify-center ml-auto">
                                  <button
                                    onClick={(e) => deleteSession(session.id, e)}
                                    className="opacity-0 cursor-pointer group-hover:opacity-100 p-1 text-gh-fg-muted hover:text-gh-danger-fg hover:bg-gh-danger-subtle rounded transition-all"
                                    title="Delete session"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Chat Messages Area */}
                <div className="flex-1 transition-all duration-300 ease-in-out">
                  <div
                    className="h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500"
                    ref={chatRef}
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgb(156 163 175) transparent",
                    }}
                  >
                    <div className="p-4 space-y-1">
                      {messages.length === 0 && !isStreaming ? (
                        <div className="flex items-center justify-center h-72 text-gh-fg-muted">
                          <div className="text-center">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                              {sessions.length === 0
                                ? "Start your first conversation"
                                : currentSession
                                  ? "No messages in this session yet"
                                  : "Select a session or start a new conversation by typing your question above."}
                            </p>
                            {sessions.length > 0 && !currentSession && (
                              <button
                                onClick={() => setIsSessionsVisible(true)}
                                className="mt-2 px-3 py-1 text-xs cursor-pointer font-semibold bg-gh-accent-emphasis text-gh-fg-on-emphasis rounded hover:bg-gh-accent-emphasis/90 transition-colors"
                              >
                                Browse Sessions
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {messages.map((message) => (
                            <div key={message.id}>
                              {message.type === "user" ? (
                                <UserMessage message={message} />
                              ) : (
                                <AIMessage message={message} />
                              )}
                            </div>
                          ))}
                          {isStreaming && <StreamingMessage />}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
