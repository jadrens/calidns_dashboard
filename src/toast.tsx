"use client";

import { isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Stack } from "@mui/material";

export type ToastSeverity = "warning" | "info" | "success" | "error";
interface ToastOptions { severity?: ToastSeverity; duration?: number; onClose?: () => void }
interface ToastItem { id: number; message: ReactNode; severity: ToastSeverity; duration: number; onClose?: () => void }

let sequence = 0;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function publish() { const snapshot = [...items]; listeners.forEach(listener => listener(snapshot)); }
function dismiss(id: number) { const item = items.find(candidate => candidate.id === id); if (!item) return; const timer = timers.get(id); if (timer) clearTimeout(timer); timers.delete(id); items = items.filter(candidate => candidate.id !== id); publish(); item.onClose?.(); }
function show(message: ReactNode, options: ToastOptions = {}) {
  const item: ToastItem = { id: ++sequence, message, severity: options.severity || "info", duration: options.duration ?? 4000, onClose: options.onClose };
  items = [...items, item]; publish(); timers.set(item.id, setTimeout(() => dismiss(item.id), item.duration)); return item.id;
}

export const toast = {
  show,
  dismiss,
  warning: (message: ReactNode, duration?: number) => show(message, { severity: "warning", duration }),
  info: (message: ReactNode, duration?: number) => show(message, { severity: "info", duration }),
  success: (message: ReactNode, duration?: number) => show(message, { severity: "success", duration }),
  error: (message: ReactNode, duration?: number) => show(message, { severity: "error", duration }),
};

export function ToastProvider() {
  const [notifications, setNotifications] = useState<ToastItem[]>([]);
  useEffect(() => { listeners.add(setNotifications); const timer = window.setTimeout(() => setNotifications([...items]), 0); return () => { window.clearTimeout(timer); listeners.delete(setNotifications); }; }, []);
  return <Stack aria-live="polite" spacing={1} sx={{ position: "fixed", zIndex: theme => theme.zIndex.snackbar, top: { xs: 12, sm: 20 }, right: { xs: 12, sm: 20 }, width: { xs: "calc(100vw - 24px)", sm: 380 }, maxWidth: "calc(100vw - 24px)", pointerEvents: "none" }}>
    {notifications.map(item => <Alert key={item.id} severity={item.severity} variant="filled" onClose={() => dismiss(item.id)} sx={{ position: "relative", overflow: "hidden", pointerEvents: "auto", boxShadow: 6, animation: "toastEnter .2s ease-out", "@keyframes toastEnter": { from: { opacity: 0, transform: "translateX(24px)" }, to: { opacity: 1, transform: "translateX(0)" } } }}>
      {item.message}<Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: "rgba(255,255,255,.32)", transformOrigin: "left", animation: `toastCountdown ${item.duration}ms linear forwards`, "@keyframes toastCountdown": { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } } }} />
    </Alert>)}
  </Stack>;
}

function childToastData(children: ReactNode): { message: ReactNode; severity: ToastSeverity } {
  if (isValidElement<{ children?: ReactNode; severity?: ToastSeverity }>(children)) return { message: children.props.children, severity: children.props.severity || "info" };
  return { message: children, severity: "info" };
}

export function Snackbar({ open, message, autoHideDuration, onClose, children }: { open: boolean; message?: ReactNode; autoHideDuration?: number | null; onClose?: (...args: unknown[]) => void; children?: ReactNode; anchorOrigin?: unknown }) {
  const activeId = useRef<number | null>(null);
  useEffect(() => {
    if (open && activeId.current === null) {
      const child = childToastData(children); activeId.current = show(message ?? child.message, { severity: child.severity, duration: autoHideDuration ?? 4000, onClose: () => { activeId.current = null; onClose?.(null, "timeout"); } });
    } else if (!open && activeId.current !== null) { const id = activeId.current; activeId.current = null; dismiss(id); }
  }, [autoHideDuration, children, message, onClose, open]);
  useEffect(() => () => { if (activeId.current !== null) { const id = activeId.current; activeId.current = null; dismiss(id); } }, []);
  return null;
}
