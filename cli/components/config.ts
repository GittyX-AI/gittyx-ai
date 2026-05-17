import { access, constants, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import inquirer from "inquirer";

const CONFIG_FILE_PATH = "gittyx.config.json";

type OnlineProvider = "gemini" | "openai";
const ONLINE_MODELS: Record<
    OnlineProvider,
    { generation: string[]; embedding: string[] }
> = {
    gemini: {
        generation: [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ],
        embedding: [
            "text-embedding-004",
            "embedding-001",
        ],
    },

    openai: {
        generation: [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
        ],
        embedding: [
            "text-embedding-3-small",
            "text-embedding-3-large",
        ],
    },
};

export const GittyxConfigSchema = z.object({
    name: z.string(),
    generated: z.boolean(),

    analyze: z.object({
        defaults: z.object({
            mode: z.enum(["online", "local"]),

            limit: z.number(),
            port: z.number(),

            online: z
                .object({
                    provider: z.enum(["gemini", "openai"]),
                    generationModel: z.string(),
                    embeddingModel: z.string(),
                })
                .nullable(),

            local: z
                .object({
                    provider: z.literal("ollama"),
                    baseUrl: z.string(),
                    generationModel: z.string(),
                    embeddingModel: z.string(),
                })
                .nullable(),
        }),
    }),
});

export type GittyxConfig = z.infer<typeof GittyxConfigSchema>;

export async function loadConfig(): Promise<GittyxConfig> {
    try {
        await access(CONFIG_FILE_PATH, constants.F_OK);
        const configFile = await readFile(CONFIG_FILE_PATH, "utf-8");
        const userConfig = JSON.parse(configFile);

        return GittyxConfigSchema.parse(userConfig);
    } catch {
        console.warn("Warning: gittyx.config.json not found. Using default configuration.");

        const isOllamaAvailable = await autoDetectOllama();
        const isGeminiAvailable = await autoDetectGemini();
        const isOpenAIAvailable = await autoDetectOpenAI();

        const useLocal = isOllamaAvailable;
        const useGemini = !useLocal && isGeminiAvailable;
        const useOpenAI = !useLocal && !useGemini && isOpenAIAvailable;

        const base: GittyxConfig = {
            name: "gittyx",
            generated: true,

            analyze: {
                defaults: {
                    mode: useLocal ? "local" : "online",

                    limit: 200,
                    port: 49251,

                    local: useLocal
                        ? {
                            provider: "ollama",
                            baseUrl: "http://localhost:11434",
                            generationModel: "deepseek-r1:8b",
                            embeddingModel: "nomic-embed-text:v1.5",
                        }
                        : null,

                    online:
                        useGemini || useOpenAI
                            ? {
                                provider: useGemini ? "gemini" : "openai",
                                generationModel: useGemini
                                    ? "gemini-2.5-flash"
                                    : "gpt-4o-mini",
                                embeddingModel: useGemini
                                    ? "text-embedding-004"
                                    : "text-embedding-3-small",
                            }
                            : null,
                },
            },
        };

        // we write this config to the file system
        await writeConfig(base);

        return base;
    }
}

async function writeConfig(config: GittyxConfig) {
    // we write the default config to the file system so that users can edit it later
    try {
        await writeFile(
            CONFIG_FILE_PATH,
            JSON.stringify(config, null, 2),
            "utf-8"
        );
    } catch (error) {
        console.error("Error writing default configuration:", error);
    }
}

export async function editConfig() {
    const current = await loadConfig();

    const baseAnswers = await inquirer.prompt([
        {
            type: "list",
            name: "mode",
            message: "Select mode",
            choices: ["online", "local"],
            default: current.analyze.defaults.mode,
        },
        {
            type: "number",
            name: "limit",
            message: "Commit limit",
            default: current.analyze.defaults.limit,
        },
        {
            type: "number",
            name: "port",
            message: "Port",
            default: current.analyze.defaults.port,
        },
    ]);

    let onlineConfig = current.analyze.defaults.online;

    if (baseAnswers.mode === "online") {
        const { onlineProvider } = await inquirer.prompt<{ onlineProvider: OnlineProvider }>([
            {
                type: "list",
                name: "onlineProvider",
                message: "Choose online provider",
                choices: ["gemini", "openai"],
                default: current.analyze.defaults.online?.provider ?? "gemini",
            },
        ]);

        const models = ONLINE_MODELS[onlineProvider];

        const { generationModel } = await inquirer.prompt([
            {
                type: "list",
                name: "generationModel",
                message: "Select generation model",
                choices: models.generation,
                default:
                    current.analyze.defaults.online?.generationModel ??
                    models.generation[0],
            },
        ]);

        const { embeddingModel } = await inquirer.prompt([
            {
                type: "list",
                name: "embeddingModel",
                message: "Select embedding model",
                choices: models.embedding,
                default:
                    current.analyze.defaults.online?.embeddingModel ??
                    models.embedding[0],
            },
        ]);

        onlineConfig = {
            provider: onlineProvider,
            generationModel,
            embeddingModel,
        };
    }

    let localConfig = current.analyze.defaults.local;

    if (baseAnswers.mode === "local") {
        const localAnswers = await inquirer.prompt([
            {
                type: "input",
                name: "baseUrl",
                message: "Ollama base URL",
                default: "http://localhost:11434",
            },
            {
                type: "input",
                name: "generationModel",
                message: "Generation model",
                default: "deepseek-r1:8b",
            },
            {
                type: "input",
                name: "embeddingModel",
                message: "Embedding model",
                default: "nomic-embed-text:v1.5",
            },
        ]);

        localConfig = {
            provider: "ollama",
            ...localAnswers,
        };
    }

    const newConfig: GittyxConfig = {
        ...current,
        analyze: {
            defaults: {
                mode: baseAnswers.mode,
                limit: baseAnswers.limit,
                port: baseAnswers.port,
                online: baseAnswers.mode === "online" ? onlineConfig : null,
                local: baseAnswers.mode === "local" ? localConfig : null,
            },
        },
    };

    await writeConfig(newConfig);

    console.log("Config updated successfully");
}

export async function autoDetectOllama() {
    // check of ollama is intalled by running GET request to localhost:11434
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        return response.ok;
    } catch {
        return false;
    }
}

export async function autoDetectGemini() {
    // check if GEMINI_API_KEY is set and valid by making a test request to the Gemini API
    return !!process.env.GEMINI_API_KEY;
}

export async function autoDetectOpenAI() {
    // check if OPENAI_API_KEY is set and valid by making a test request to the OpenAI API
    return !!process.env.OPENAI_API_KEY;
}

