import React, { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Shuffle, Trash2 } from "lucide-react";
import type { GradientConfig, GradientPoint, GradientPresetId } from "../../domain/models";
import { useI18n } from "../../i18n";
import {
  GRADIENT_PRESETS,
  generateRandomCuratedGradient,
  getDefaultGradientConfig,
} from "../appearance/gradientEngine";

export interface GradientEditorProps {
  gradient: GradientConfig | undefined;
  dark: boolean;
  onChange: (gradient: GradientConfig) => void;
}

const POSITION_SHORTCUTS = [
  { label: "TL", x: 20, y: 20, title: "Top-Left" },
  { label: "TR", x: 80, y: 20, title: "Top-Right" },
  { label: "C", x: 50, y: 50, title: "Center" },
  { label: "BL", x: 20, y: 80, title: "Bottom-Left" },
  { label: "BR", x: 80, y: 80, title: "Bottom-Right" },
] as const;

export function GradientEditor({ gradient, dark, onChange }: GradientEditorProps) {
  const { t } = useI18n();
  const colorInputId = useId();
  const currentConfig = useMemo(() => gradient ?? getDefaultGradientConfig(), [gradient]);
  const [selectedId, setSelectedId] = useState<string>(() => currentConfig.points[0]?.id ?? "p-1");

  const selectedPoint = useMemo(() => {
    return currentConfig.points.find((p) => p.id === selectedId) ?? currentConfig.points[0];
  }, [currentConfig.points, selectedId]);

  const selectedIndex = useMemo(() => {
    return currentConfig.points.findIndex((p) => p.id === selectedPoint?.id);
  }, [currentConfig.points, selectedPoint?.id]);

  const updatePoint = (id: string, patch: Partial<GradientPoint>) => {
    const nextPoints = currentConfig.points.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onChange({
      preset: "custom",
      points: nextPoints,
    });
  };

  const selectPreset = (presetId: Exclude<GradientPresetId, "custom">) => {
    const preset = GRADIENT_PRESETS[presetId];
    if (!preset) return;
    const next = structuredClone(preset);
    setSelectedId(next.points[0]?.id ?? "p-1");
    onChange(next);
  };

  const handleRandomize = () => {
    const random = generateRandomCuratedGradient(dark, currentConfig.points.length);
    setSelectedId(random.points[0]?.id ?? "p-1");
    onChange(random);
  };

  const handleAddColor = () => {
    if (currentConfig.points.length >= 10) return;
    // Generate a complementary or harmonious new color point
    const newId = `p-${Date.now().toString(36).slice(-5)}`;
    const newPoint: GradientPoint = {
      id: newId,
      color: dark ? "#7aa2ff" : "#3b82f6",
      x: 50,
      y: 50,
      spread: 70,
      opacity: dark ? 0.35 : 0.28,
      enabled: true,
    };
    const nextPoints = [...currentConfig.points, newPoint];
    setSelectedId(newId);
    onChange({
      preset: "custom",
      points: nextPoints,
    });
  };

  const handleRemoveColor = (id: string) => {
    if (currentConfig.points.length <= 1) return;
    const nextPoints = currentConfig.points.filter((p) => p.id !== id);
    setSelectedId(nextPoints[0]?.id ?? "");
    onChange({
      preset: "custom",
      points: nextPoints,
    });
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= currentConfig.points.length) return;
    const nextPoints = [...currentConfig.points];
    const [moved] = nextPoints.splice(fromIndex, 1);
    if (moved) {
      nextPoints.splice(toIndex, 0, moved);
      onChange({
        preset: "custom",
        points: nextPoints,
      });
    }
  };

  const presetList: Array<{ id: Exclude<GradientPresetId, "custom">; label: string }> = [
    { id: "current", label: t("settings.gradientPresetCurrent") },
    { id: "cool", label: t("settings.gradientPresetCool") },
    { id: "aurora", label: t("settings.gradientPresetAurora") },
    { id: "warm", label: t("settings.gradientPresetWarm") },
    { id: "neutral", label: t("settings.gradientPresetNeutral") },
  ];

  return (
    <div className="gradient-editor" role="region" aria-label={t("settings.backgroundGradient")}>
      <div className="gradient-editor__top-bar">
        <div className="gradient-editor__presets" role="group" aria-label={t("settings.gradientPresets")}>
          {presetList.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`gradient-preset-btn ${currentConfig.preset === item.id ? "is-active" : ""}`}
              onClick={() => selectPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="gradient-random-btn"
          onClick={handleRandomize}
          title={t("settings.gradientRandom")}
        >
          <Shuffle size={14} aria-hidden="true" />
          <span>{t("settings.gradientRandom")}</span>
        </button>
      </div>

      <div className="gradient-editor__swatches-row">
        <span className="gradient-editor__swatches-label">{t("settings.gradientColor")} ({currentConfig.points.length}/10)</span>
        <div className="gradient-swatches-track" role="tablist" aria-label={t("settings.gradientColor")}>
          {currentConfig.points.map((point, index) => {
            const isSelected = selectedPoint?.id === point.id;
            return (
              <button
                type="button"
                key={point.id}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`gradient-swatch-pill ${isSelected ? "is-selected" : ""}`}
                style={{ backgroundColor: point.color }}
                onClick={() => setSelectedId(point.id)}
                title={`${t("settings.gradientColor")} ${index + 1}: ${point.color}`}
              >
                <span className="gradient-swatch-inner" />
              </button>
            );
          })}

          {currentConfig.points.length < 10 ? (
            <button
              type="button"
              className="gradient-add-btn"
              onClick={handleAddColor}
              title={t("settings.gradientAddColor")}
              aria-label={t("settings.gradientAddColor")}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {selectedPoint ? (
        <div className="gradient-inspector-card">
          <div className="gradient-inspector-row gradient-inspector-row--header">
            <div className="gradient-color-field">
              <label htmlFor={colorInputId} className="gradient-color-preview" style={{ backgroundColor: selectedPoint.color }}>
                <input
                  id={colorInputId}
                  type="color"
                  value={selectedPoint.color}
                  onChange={(e) => updatePoint(selectedPoint.id, { color: e.target.value })}
                />
              </label>
              <span className="gradient-color-hex">{selectedPoint.color.toUpperCase()}</span>
            </div>

            <div className="gradient-inspector-actions">
              <button
                type="button"
                className="gradient-action-btn"
                disabled={selectedIndex <= 0}
                onClick={() => handleMove(selectedIndex, selectedIndex - 1)}
                title={t("generic.moveLeft")}
                aria-label={t("generic.moveLeft")}
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gradient-action-btn"
                disabled={selectedIndex < 0 || selectedIndex >= currentConfig.points.length - 1}
                onClick={() => handleMove(selectedIndex, selectedIndex + 1)}
                title={t("generic.moveRight")}
                aria-label={t("generic.moveRight")}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gradient-action-btn gradient-action-btn--danger"
                disabled={currentConfig.points.length <= 1}
                onClick={() => handleRemoveColor(selectedPoint.id)}
                title={t("settings.gradientRemoveColor")}
                aria-label={t("settings.gradientRemoveColor")}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="gradient-inspector-row">
            <span className="gradient-label">{t("settings.gradientPosition")}</span>
            <div className="gradient-pos-shortcuts">
              {POSITION_SHORTCUTS.map((pos) => (
                <button
                  type="button"
                  key={pos.label}
                  className={`gradient-pos-btn ${Math.abs(selectedPoint.x - pos.x) < 8 && Math.abs(selectedPoint.y - pos.y) < 8 ? "is-active" : ""}`}
                  onClick={() => updatePoint(selectedPoint.id, { x: pos.x, y: pos.y })}
                  title={pos.title}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div className="gradient-range-grid">
            <label className="range-control">
              <span>
                <strong>X</strong>
                <output>{Math.round(selectedPoint.x)}%</output>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(selectedPoint.x)}
                style={{ "--range-progress": `${selectedPoint.x}%` } as React.CSSProperties}
                onInput={(e) => updatePoint(selectedPoint.id, { x: Number(e.currentTarget.value) })}
              />
            </label>

            <label className="range-control">
              <span>
                <strong>Y</strong>
                <output>{Math.round(selectedPoint.y)}%</output>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(selectedPoint.y)}
                style={{ "--range-progress": `${selectedPoint.y}%` } as React.CSSProperties}
                onInput={(e) => updatePoint(selectedPoint.id, { y: Number(e.currentTarget.value) })}
              />
            </label>

            <label className="range-control">
              <span>
                <strong>{t("settings.gradientIntensity")}</strong>
                <output>{Math.round(selectedPoint.opacity * 100)}%</output>
              </span>
              <input
                type="range"
                min={5}
                max={90}
                value={Math.round(selectedPoint.opacity * 100)}
                style={{ "--range-progress": `${((selectedPoint.opacity * 100 - 5) / 85) * 100}%` } as React.CSSProperties}
                onInput={(e) => updatePoint(selectedPoint.id, { opacity: Number(e.currentTarget.value) / 100 })}
              />
            </label>

            <label className="range-control">
              <span>
                <strong>{t("settings.gradientSpread")}</strong>
                <output>{Math.round(selectedPoint.spread)}%</output>
              </span>
              <input
                type="range"
                min={20}
                max={120}
                value={Math.round(selectedPoint.spread)}
                style={{ "--range-progress": `${((selectedPoint.spread - 20) / 100) * 100}%` } as React.CSSProperties}
                onInput={(e) => updatePoint(selectedPoint.id, { spread: Number(e.currentTarget.value) })}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
