import React, { useRef, useState } from 'react';
import {
  AtSign,
  Dna,
  FolderPlus,
  ImagePlus,
  Send,
  Slash,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { AspectRatio, DreaminaSkill, ElementVault, ResolutionTier } from '../types/studio';
import { estimateZeroMarkupCostUsd } from '../services/executionRouter';

export const PromptDock: React.FC = () => {
  const {
    promptText,
    promptMode,
    promptAspect,
    promptDurationSec,
    promptResolution,
    elements,
    skills,
    activeProvider,
    selectedNodeIds,
    nodes,
    setPromptText,
    setPromptMode,
    setPromptAspect,
    setPromptDurationSec,
    setPromptResolution,
    applySkillPreset,
    submitPromptGeneration,
    addElementVault,
    addReferenceImageToVault,
    removeReferenceFromVault,
    spawnStyleDnaNode,
    openProviderModal,
  } = useStudioStore();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showElementMenu, setShowElementMenu] = useState(false);
  const [elementFilter, setElementFilter] = useState('');
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [skillCategory, setSkillCategory] = useState<string>('All');
  const [vaultDrawerOpen, setVaultDrawerOpen] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    elements[0]?.id || ''
  );
  const [newVaultHandle, setNewVaultHandle] = useState('');
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultCategory, setNewVaultCategory] =
    useState<ElementVault['category']>('character');
  const [isGenerating, setIsGenerating] = useState(false);

  const activeVault =
    elements.find((e) => e.id === selectedVaultId) || elements[0];

  const handlePromptChange = (val: string) => {
    setPromptText(val);

    const atMatch = val.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    if (atMatch) {
      setElementFilter(atMatch[1].toLowerCase());
      setShowElementMenu(true);
      setShowSkillMenu(false);
      return;
    } else {
      setShowElementMenu(false);
    }

    const slashMatch = val.match(/(?:^|\s)\/([A-Za-z0-9_-]*)$/);
    if (slashMatch) {
      setShowSkillMenu(true);
      setShowElementMenu(false);
    } else {
      setShowSkillMenu(false);
    }
  };

  const insertElementHandle = (handle: string) => {
    const replaced = promptText.replace(/(?:^|\s)@[A-Za-z0-9_]*$/, (m) =>
      m.startsWith(' ') ? ` ${handle} ` : `${handle} `
    );
    const next =
      replaced === promptText
        ? `${promptText.trimEnd()} ${handle} `.trimStart()
        : replaced;
    setPromptText(next);
    setShowElementMenu(false);
    textareaRef.current?.focus();
  };

  const handleSelectSkill = (skill: DreaminaSkill) => {
    applySkillPreset(skill);
    setShowSkillMenu(false);
    textareaRef.current?.focus();
  };

  const handleGenerate = async () => {
    if (isGenerating || !promptText.trim()) return;
    setIsGenerating(true);
    try {
      await submitPromptGeneration();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadRefFile = (
    vaultId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addReferenceImageToVault(vaultId, file.name.slice(0, 18), reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stampSelectedFrameIntoVault = (vaultId: string) => {
    const sel = nodes.find((n) => n.id === selectedNodeIds[0]);
    if (sel?.imageUrl) {
      addReferenceImageToVault(vaultId, sel.title.slice(0, 18), sel.imageUrl);
    }
  };

  const filteredElements = elements.filter(
    (el) =>
      !elementFilter ||
      el.handle.toLowerCase().includes(elementFilter) ||
      el.name.toLowerCase().includes(elementFilter)
  );

  const skillCategories = ['All', 'Storyboard', 'Camera', 'Commercial', 'Omni Multi-Turn', 'MCP Tool'];
  const filteredSkills = skills.filter(
    (sk) => skillCategory === 'All' || sk.category === skillCategory
  );

  const estimatedCost = estimateZeroMarkupCostUsd(
    activeProvider,
    promptMode === 'video' || promptMode === 'multi-turn' ? 'video' : 'image',
    promptDurationSec,
    promptResolution
  );

  return (
    <div className="relative w-full max-w-4xl mx-auto px-3 z-40 pointer-events-auto">
      {showElementMenu && (
        <div className="absolute bottom-full mb-2.5 left-4 w-[430px] rounded-2xl bg-[#0E121B]/98 border border-violet-500/45 shadow-2xl backdrop-blur-xl p-3 space-y-2 z-50">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
            <span className="font-semibold text-violet-300 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" /> `@Elements` Subject & Style Continuity Lock
            </span>
            <button
              onClick={() => {
                setShowElementMenu(false);
                setVaultDrawerOpen(true);
              }}
              className="text-[11px] text-sky-400 hover:underline"
            >
              Manage 6-Image Vaults →
            </button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {filteredElements.map((vault) => (
              <button
                key={vault.id}
                onClick={() => insertElementHandle(vault.handle)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-violet-500/20 border border-slate-800 hover:border-violet-500/40 transition text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    {vault.references.slice(0, 3).map((ref) => (
                      <img
                        key={ref.id}
                        src={ref.dataUrl}
                        alt={ref.label}
                        className="w-8 h-8 rounded-lg object-cover ring-2 ring-[#0E121B]"
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-white">
                        {vault.handle}
                      </span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {vault.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {vault.description}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded shrink-0">
                  {vault.references.length}/6 Refs
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showSkillMenu && (
        <div className="absolute bottom-full mb-2.5 left-4 right-4 max-w-2xl rounded-2xl bg-[#0E121B]/98 border border-sky-500/45 shadow-2xl backdrop-blur-xl p-3 space-y-2.5 z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
              <Slash className="w-3.5 h-3.5" /> Dreamina `/` Filmmaking Skill Engine
            </span>
            <div className="flex items-center gap-1">
              {skillCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSkillCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                    skillCategory === cat
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setShowSkillMenu(false)}
                className="ml-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => handleSelectSkill(skill)}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-400/50 text-left transition space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-sky-300">
                    {skill.slash}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-500/30">
                    {skill.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">{skill.title}</p>
                <p className="text-[10px] text-slate-400 line-clamp-2">
                  {skill.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {vaultDrawerOpen && activeVault && (
        <div className="absolute bottom-full mb-2.5 inset-x-3 rounded-2xl bg-[#0D111A]/98 border border-violet-500/45 shadow-2xl backdrop-blur-xl p-4 z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">
                `@Elements` Identity & Product Continuity Vaults (Up to 6 References / Lock)
              </span>
            </div>
            <button
              onClick={() => setVaultDrawerOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 border-r border-slate-800/80 pr-3">
              {elements.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVaultId(v.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${
                    activeVault.id === v.id
                      ? 'bg-violet-600/25 border border-violet-400/50 text-white'
                      : 'bg-slate-900/70 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-bold">{v.handle}</div>
                    <div className="text-[11px] text-slate-400">{v.name}</div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-violet-300">
                    {v.references.length}/6
                  </span>
                </button>
              ))}

              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <FolderPlus className="w-3.5 h-3.5" /> New `@Element` Vault
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newVaultHandle}
                    onChange={(e) => setNewVaultHandle(e.target.value)}
                    placeholder="@Cyber_Car"
                    className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <select
                    value={newVaultCategory}
                    onChange={(e) =>
                      setNewVaultCategory(e.target.value as ElementVault['category'])
                    }
                    className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="character">Character</option>
                    <option value="product">Product</option>
                    <option value="style">Style</option>
                    <option value="voice">Voice</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="Display Name"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button
                    onClick={() => {
                      if (!newVaultHandle.trim()) return;
                      addElementVault(
                        newVaultHandle,
                        newVaultName || newVaultHandle,
                        newVaultCategory,
                        'Custom locked multi-reference identity vault'
                      );
                      setNewVaultHandle('');
                      setNewVaultName('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm font-bold text-violet-300">
                    {activeVault.handle}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {activeVault.description}
                  </span>
                </div>
                <button
                  onClick={() => insertElementHandle(activeVault.handle)}
                  className="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/35 border border-violet-400/40 text-violet-200 text-xs font-medium"
                >
                  Insert {activeVault.handle} in Prompt
                </button>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {activeVault.references.map((ref) => (
                  <div
                    key={ref.id}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-900"
                  >
                    <img
                      src={ref.dataUrl}
                      alt={ref.label}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeReferenceFromVault(activeVault.id, ref.id)}
                      title="Remove reference"
                      className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 rounded bg-black/80 text-rose-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] text-slate-200 px-1 py-0.5 truncate text-center">
                      {ref.label}
                    </span>
                  </div>
                ))}

                {activeVault.references.length < 6 && (
                  <label className="aspect-square rounded-xl border border-dashed border-slate-600 hover:border-violet-400 bg-slate-900/60 flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-400 hover:text-violet-300 transition">
                    <Upload className="w-4 h-4" />
                    <span className="text-[10px]">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadRefFile(activeVault.id, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span>
                  Gemini Omni 1.2 Flash sends all {activeVault.references.length} `inline_data`
                  references at $0 markup.
                </span>
                {selectedNodeIds.length > 0 && activeVault.references.length < 6 && (
                  <button
                    onClick={() => stampSelectedFrameIntoVault(activeVault.id)}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
                  >
                    <ImagePlus className="w-3.5 h-3.5" /> Capture Selected Canvas Frame
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#0D111A]/95 border border-slate-700/75 shadow-2xl backdrop-blur-2xl p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setShowSkillMenu((v) => !v);
                setShowElementMenu(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-xs font-medium transition"
            >
              <Slash className="w-3.5 h-3.5" />
              <span>Skills</span>
            </button>

            <button
              onClick={() => {
                setVaultDrawerOpen((v) => !v);
                setShowElementMenu(false);
                setShowSkillMenu(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/35 text-violet-300 text-xs font-medium transition"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>Elements ({elements.length})</span>
            </button>

            <button
              onClick={() => spawnStyleDnaNode()}
              title="Extract Color Palette + Lighting + Lens + Film Stock into a Style DNA Lock Node"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-medium transition"
            >
              <Dna className="w-3.5 h-3.5" />
              <span>Style DNA Node</span>
            </button>

            <div className="hidden lg:flex items-center gap-1 pl-1">
              {skills.slice(0, 4).map((sk) => (
                <button
                  key={sk.id}
                  onClick={() => handleSelectSkill(sk)}
                  className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition"
                >
                  {sk.slash}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => openProviderModal('byok')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 transition"
          >
            <Sparkles className="w-3 h-3" />
            <span>
              {activeProvider === 'local-canvas'
                ? 'Local Engine · $0.00'
                : `${activeProvider} · ~$${estimatedCost.toFixed(2)} ($0 Markup)`}
            </span>
          </button>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={promptText}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Type `@` to lock @Hero_Kael / @Cyber_Sneaker (up to 6 refs) or `/` for Dreamina Skills (/9-Grid Storyboard, /Cinematic Long Take)..."
            className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-violet-500/70 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none"
          />

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-[54px] px-4 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-glow-dream transition shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{isGenerating ? 'Synthesizing...' : 'Generate'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-slate-950/90 p-0.5 rounded-lg border border-slate-800">
              {(
                [
                  { id: 'image', label: 'Image Frame' },
                  { id: 'video', label: '🎬 Omni 1.2 Video' },
                  { id: '9-grid', label: '⊞ 9-Grid Sheet' },
                  { id: '4-angle', label: '🎥 4-Angle' },
                  { id: 'multi-turn', label: '🌿 Multi-Turn' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPromptMode(m.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                    promptMode === m.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <select
              value={promptAspect}
              onChange={(e) => setPromptAspect(e.target.value as AspectRatio)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
            >
              <option value="16:9">16:9 Cinema</option>
              <option value="21:9">21:9 Anamorphic</option>
              <option value="9:16">9:16 Vertical</option>
              <option value="1:1">1:1 Square</option>
            </select>

            {(promptMode === 'video' || promptMode === 'multi-turn') && (
              <select
                value={promptDurationSec}
                onChange={(e) => setPromptDurationSec(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-sky-300"
              >
                <option value={4}>4s Cut</option>
                <option value={6}>6s Shot</option>
                <option value={8}>8s Standard</option>
                <option value={10}>10s Extended</option>
                <option value={15}>15s Omni Max</option>
              </select>
            )}

            <select
              value={promptResolution}
              onChange={(e) => setPromptResolution(e.target.value as ResolutionTier)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
            >
              <option value="360p">360p Fast Draft</option>
              <option value="720p">720p HD</option>
              <option value="1080p">1080p Full HD</option>
              <option value="2K">2K Master</option>
              <option value="4K">4K Ultra</option>
            </select>
          </div>

          <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
            ⌘+Enter to synthesize
          </span>
        </div>
      </div>
    </div>
  );
};
