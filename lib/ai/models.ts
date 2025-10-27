export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Grok Vision",
    description: "Advanced multimodal model with vision and text capabilities",
  },
  {
    id: "chat-model-reasoning",
    name: "Grok Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
  {
    id: "openai-gpt-4o",
    name: "GPT-4o",
    description: "OpenAI's most advanced multimodal model",
  },
  {
    id: "openai-gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and cost-effective OpenAI model",
  },
  {
    id: "openai-o1",
    name: "OpenAI o1",
    description: "Advanced reasoning model with extended thinking",
  },
  {
    id: "openai-o1-mini",
    name: "OpenAI o1-mini",
    description: "Efficient reasoning model for faster responses",
  },
];
