"use client";

import { useEffect, useRef, useCallback } from "react";

export function useKeyboardNavigation({
  rowCount,
  colCount,
  onNavigate,
  onAddRow,
  onDeleteRow,
  onEscape,
  enabled = true,
}: {
  rowCount: number;
  colCount: number;
  onNavigate: (row: number, col: number, direction: "next" | "prev" | "up" | "down") => void;
  onAddRow?: () => void;
  onDeleteRow?: (row: number) => void;
  onEscape?: () => void;
  enabled?: boolean;
}) {
  const currentRow = useRef(0);
  const currentCol = useRef(0);
  const isEditing = useRef(false);

  const focusCell = useCallback((row: number, col: number) => {
    const selector = `[data-row="${row}"][data-col="${col}"]`;
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.select();
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    
    if (e.key === "Escape") {
      e.preventDefault();
      if (isInput) {
        target.blur();
      }
      onEscape?.();
      return;
    }

    if (!isInput) return;

    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    
    if (isNaN(row) || isNaN(col)) return;

    currentRow.current = row;
    currentCol.current = col;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (e.shiftKey) {
          onNavigate(row, col, "prev");
        } else {
          if (col < colCount - 1) {
            onNavigate(row, col, "next");
          } else if (row < rowCount - 1) {
            onNavigate(row + 1, 0, "down");
          } else if (onAddRow) {
            onAddRow();
            setTimeout(() => focusCell(row + 1, 0), 50);
          }
        }
        break;

      case "Tab":
        if (e.shiftKey) {
          e.preventDefault();
          onNavigate(row, col, "prev");
        } else {
          e.preventDefault();
          if (col < colCount - 1) {
            onNavigate(row, col, "next");
          } else if (row < rowCount - 1) {
            onNavigate(row + 1, 0, "down");
          } else if (onAddRow) {
            onAddRow();
            setTimeout(() => focusCell(row + 1, 0), 50);
          }
        }
        break;

      case "ArrowRight":
        if (col < colCount - 1) {
          e.preventDefault();
          onNavigate(row, col, "next");
        }
        break;

      case "ArrowLeft":
        if (col > 0) {
          e.preventDefault();
          onNavigate(row, col, "prev");
        }
        break;

      case "ArrowDown":
        if (row < rowCount - 1) {
          e.preventDefault();
          onNavigate(row + 1, col, "down");
        }
        break;

      case "ArrowUp":
        if (row > 0) {
          e.preventDefault();
          onNavigate(row - 1, col, "up");
        }
        break;

      case "Delete":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onDeleteRow?.(row);
        }
        break;
    }
  }, [rowCount, colCount, onNavigate, onAddRow, onDeleteRow, onEscape, enabled, focusCell]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { focusCell };
}

export function useFormKeyboardShortcuts({
  onSave,
  onCancel,
  onPrint,
  onNew,
}: {
  onSave?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onNew?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        onPrint?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        onNew?.();
      }
      if (e.key === "Escape") {
        onCancel?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onCancel, onPrint, onNew]);
}