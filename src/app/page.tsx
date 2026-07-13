"use client";

import { useState } from "react";
import { AdvisorTab } from "@/components/AdvisorTab";
import { VectorizeTab } from "@/components/VectorizeTab";
import { PersonaTab } from "@/components/PersonaTab";

type TabKey = "advisor" | "vectorize" | "persona";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "advisor", label: "Advisor Chat", icon: "💬" },
  { key: "vectorize", label: "Vectorize Knowledge Base", icon: "📚" },
  { key: "persona", label: "Persona Interview", icon: "🎤" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("advisor");

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-bg font-bold text-sm">
            S
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">Sing Creative Advisor</h1>
            <p className="text-[11px] text-muted leading-none mt-0.5">
              Business Central process intelligence, powered by your knowledge base
            </p>
          </div>
        </div>
        <nav className="flex gap-1 bg-surface-2 rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-text hover:bg-surface"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        {activeTab === "advisor" && <AdvisorTab />}
        {activeTab === "vectorize" && <VectorizeTab />}
        {activeTab === "persona" && <PersonaTab />}
      </main>
    </div>
  );
}
