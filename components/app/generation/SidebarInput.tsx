"use client";

import { useState } from "react";
import Link from "next/link";
import { appConfig } from "@/config/app.config";

interface SidebarInputProps {
  onSubmit: (prompt: string, model: string) => void;
  disabled?: boolean;
}

export default function SidebarInput({ onSubmit, disabled = false }: SidebarInputProps) {
  const [prompt, setPrompt] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(appConfig.ai.defaultModel);

  const models = appConfig.ai.availableModels.map(model => ({
    id: model,
    name: appConfig.ai.modelDisplayNames[model] || model,
  }));

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || disabled) return;

    onSubmit(prompt.trim(), selectedModel);

    setPrompt("");
  };

  return (
    <div className="w-full">
      <div>
        <div className="p-4 border-b border-gray-100">
         <Link href="/">
          <button className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
            Generate a new website
          </button>
         </Link>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Describe your app</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={disabled}
              placeholder="e.g., A landing page for a SaaS product..."
              className="w-full px-3 py-2 text-xs text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400 resize-none min-h-[60px]"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || disabled}
              className={`
                w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all
                ${prompt.trim() && !disabled
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {disabled ? 'Building...' : 'Build App'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
