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

import express from "express"
import path from "path"
import fs from "fs"
import http from "http"
import { WebSocketServer } from "ws"
import { getCommits, getOverallSummary, getTimelineChartConfig } from "../utils/insight"
import { v4 as uuidv4 } from "uuid"
import { getSessionFilePath, loadSessionHistory, saveSessionHistory, listSessionIds } from "../sessions/manager"
import { asciiArtBanner, logging } from "../utils/logging"
import AgentGittyx from "../agent/agent"
import VectorService from "../vectorstore/service"

export async function startDashboard(agent: AgentGittyx, gittyxStore: VectorService, port: number, limit: number) {
  const app = express()
  const dashboardDist = path.resolve(__dirname, "../..")

  logging(`Production mode: serving built dashboard from: ${dashboardDist}`)

  app.use(express.static(dashboardDist))
  app.use(express.json()) // Add JSON parsing middleware

  // Existing REST API route
  app.get("/api/insights", (req, res) => {
    try {
      const data = {
        commits: getCommits(limit),
        summary: getOverallSummary(),
        chartConfig: getTimelineChartConfig(),
      }
      res.json(data)
    } catch (error) {
      logging(`API error: ${error}`, "error")
      res.status(500).json({ error: "Failed to load insights" })
    }
  })

  // Session management endpoints
  app.get("/api/sessions", (req, res) => {
    try {
      const sessionIds = listSessionIds()
      const sessions = sessionIds.map((sessionId) => {
        const history = loadSessionHistory(sessionId)
        const filePath = getSessionFilePath(sessionId)
        const stats = fs.statSync(filePath)

        // Get first user message as title
        const firstUserMessage = history.find((msg) => msg.role === "user")
        const title = firstUserMessage
          ? firstUserMessage.text.length > 50
            ? firstUserMessage.text.substring(0, 50) + "..."
            : firstUserMessage.text
          : "New Conversation"

        return {
          id: sessionId,
          title,
          messageCount: history.length,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        }
      })

      // Sort by most recently updated
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

      res.json(sessions)
    } catch (error) {
      logging(`Failed to load sessions: ${error}`, "error")
      res.status(500).json({ error: "Failed to load sessions" })
    }
  })

  app.get("/api/sessions/:sessionId", (req, res) => {
    try {
      const { sessionId } = req.params
      const history = loadSessionHistory(sessionId)

      // Convert to frontend message format
      const messages = history.map((msg, index) => ({
        id: `${sessionId}-${index}`,
        type: msg.role === "user" ? "user" : "ai",
        content: msg.text,
        timestamp: new Date(), // We don't store individual timestamps, so use current time
      }))

      res.json({ messages })
    } catch (error) {
      logging(`Failed to load session: ${error}`, "error")
      res.status(500).json({ error: "Failed to load session" })
    }
  })

  app.delete("/api/sessions/:sessionId", (req, res) => {
    try {
      const { sessionId } = req.params
      const filePath = getSessionFilePath(sessionId)

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        res.json({ success: true })
      } else {
        res.status(404).json({ error: "Session not found" })
      }
    } catch (error) {
      logging(`Failed to delete session: ${error}`, "error")
      res.status(500).json({ error: "Failed to delete session" })
    }
  })

  // Serve the frontend
  const indexFile = path.resolve(dashboardDist, "index.html")
  if (fs.existsSync(indexFile)) {
    app.get("/", (_req, res) => {
      res.sendFile(indexFile)
    })
  } else {
    logging("index.html not found in dist folder.", "error")
  }

  // Wrap express app in a raw HTTP server for WebSocket support
  const server = http.createServer(app)

  // WebSocket chat handler
  const wss = new WebSocketServer({ server })

  wss.on("connection", (ws) => {
    logging("WebSocket client connected")

    // Store sessionId per connection
    let sessionId: string | null = null

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg.toString())

        // If client sends a sessionId, use it, otherwise create a new one
        if (data.sessionId) {
          sessionId = data.sessionId
        } else if (!sessionId) {
          sessionId = uuidv4()
          // Send the new sessionId back to client
          ws.send(JSON.stringify({ type: "session", sessionId }))
        }

        const query = data.query
        if (!query) {
          ws.send(JSON.stringify({ type: "error", error: "Query is empty." }))
          return
        }

        // Load existing session history
        const history = loadSessionHistory(sessionId)

        // Add user message to history
        history.push({ role: "user", text: query })
        saveSessionHistory(sessionId, history)

        let aiResponse = ""

        for await (const textChunk of agent.streamChatResponse(query, sessionId, gittyxStore)) {
          aiResponse += textChunk
          for (const char of textChunk) {
            await new Promise((r) => setTimeout(r, 15))
            ws.send(JSON.stringify({ type: "response", text: char }))
          }
        }

        // Add AI response to history
        history.push({ role: "model", text: aiResponse })
        saveSessionHistory(sessionId, history)

        ws.send(JSON.stringify({ type: "done" }))
      } catch (err) {
        logging(`WebSocket chat error: ${err}`, "error")
        ws.send(JSON.stringify({ type: "error", error: "Internal error" }))
      }
    })

    ws.on("close", () => {
      logging("WebSocket client disconnected")
    })
  })

  server.listen(port, () => {
    asciiArtBanner(port)
  });

}
