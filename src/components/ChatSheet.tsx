import { useEffect, useId, useRef, useState } from "react";
import type { ChatEntry } from "../types";
import { useVisualViewport } from "../lib/useVisualViewport";

interface ChatSheetProps {
  entries: ChatEntry[];
  connected: boolean;
  lang: "ro" | "en";
  onClose: () => void;
  onSend: (text: string) => void;
}

function focusableIn(element: HTMLElement | null) {
  if (!element) return [] as HTMLElement[];
  return [...element.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )].filter((node) => !node.hasAttribute("hidden"));
}

/**
 * Global participant Chat surface. It deliberately lives above activity-local
 * sheets so Canvas/ranking controls cannot cover it on iOS. The visual viewport
 * calculation avoids the fixed-60vh composer that used to disappear under the
 * mobile Safari keyboard.
 */
export default function ChatSheet({ entries, connected, lang, onClose, onSend }: ChatSheetProps) {
  const viewport = useVisualViewport();
  const mobile = viewport.width > 0 && viewport.width < 640;
  const titleId = useId();
  const sheetRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nearBottomRef = useRef(true);
  const knownLengthRef = useRef(entries.length);
  const [text, setText] = useState("");
  const [newBelow, setNewBelow] = useState(0);

  // iOS exposes a visual viewport smaller than the layout viewport while the
  // keyboard is visible. Some Safari versions already position fixed elements
  // in that viewport; in that case this safely resolves to zero.
  const keyboardInset = Math.max(0, viewport.layoutHeight - viewport.height - viewport.offsetTop);
  const mobileHeight = Math.max(180, Math.min(680, viewport.height - 12));

  const scrollToLatest = (behavior: ScrollBehavior = "auto") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    nearBottomRef.current = true;
    setNewBelow(0);
  };

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    // A newly opened sheet starts at the latest entry; later messages preserve
    // reading position unless the person is already at the bottom.
    requestAnimationFrame(() => scrollToLatest());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const added = Math.max(0, entries.length - knownLengthRef.current);
    knownLengthRef.current = entries.length;
    if (!added) return;
    if (nearBottomRef.current) requestAnimationFrame(() => scrollToLatest());
    else setNewBelow((count) => count + added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const nodes = focusableIn(sheetRef.current);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !connected) return;
    onSend(value);
    setText("");
    requestAnimationFrame(() => scrollToLatest("smooth"));
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default bg-ink-950/45 backdrop-blur-[1px] sm:hidden"
        aria-label={lang === "ro" ? "Închide chatul" : "Close chat"}
        onClick={onClose}
      />
      <aside
        ref={sheetRef}
        className="safe-bottom fixed inset-x-2 z-[70] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900/98 text-white shadow-pop backdrop-blur-xl sm:inset-x-auto sm:right-3 sm:w-[360px]"
        style={mobile
          ? { height: `${mobileHeight}px`, bottom: `calc(${keyboardInset + 6}px + env(safe-area-inset-bottom))` }
          : { bottom: "0.75rem", maxHeight: "min(60vh, 640px)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <div>
            <h2 id={titleId} className="font-display text-base font-bold text-white">
              {lang === "ro" ? "Chat de echipă" : "Team chat"}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-400">
              {connected
                ? (lang === "ro" ? "Mesajele sunt vizibile tuturor participanților." : "Messages are visible to every participant.")
                : (lang === "ro" ? "Se reconectează… poți citi istoricul." : "Reconnecting… you can read the history.")}
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-ink-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
            onClick={onClose}
            aria-label={lang === "ro" ? "Închide chatul" : "Close chat"}
            title={lang === "ro" ? "Închide chatul" : "Close chat"}
          >
            ×
          </button>
        </header>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3"
          onScroll={(event) => {
            const list = event.currentTarget;
            const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
            nearBottomRef.current = nearBottom;
            if (nearBottom) setNewBelow(0);
          }}
          aria-label={lang === "ro" ? "Mesaje în chat" : "Chat messages"}
        >
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">
              {lang === "ro" ? "Începe conversația cu echipa." : "Start the conversation with your team."}
            </p>
          ) : entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.045] px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: entry.color }}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                <span>{entry.name}</span>
                <time className="ml-auto font-medium text-ink-500" dateTime={new Date(entry.at).toISOString()}>
                  {new Date(entry.at).toLocaleTimeString(lang === "ro" ? "ro-RO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <p className="mt-1 break-words leading-relaxed text-ink-100">{entry.text}</p>
            </article>
          ))}
        </div>

        {newBelow > 0 && (
          <div className="absolute bottom-[84px] left-1/2 z-10 -translate-x-1/2">
            <button
              type="button"
              className="rounded-full border border-brand-300/40 bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-chip"
              onClick={() => scrollToLatest("smooth")}
            >
              {lang === "ro" ? `${newBelow} mesaje noi` : `${newBelow} new message${newBelow === 1 ? "" : "s"}`}
            </button>
          </div>
        )}

        <form className="flex shrink-0 gap-2 border-t border-white/10 bg-ink-900/90 p-3" onSubmit={send}>
          <label className="sr-only" htmlFor="team-chat-composer">{lang === "ro" ? "Mesaj" : "Message"}</label>
          <input
            ref={inputRef}
            id="team-chat-composer"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-base text-white outline-none placeholder:text-ink-500 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/20"
            value={text}
            maxLength={500}
            onChange={(event) => setText(event.target.value)}
            placeholder={lang === "ro" ? "Scrie un mesaj…" : "Write a message…"}
            disabled={!connected}
            autoComplete="off"
          />
          <button className="btn-primary btn-sm shrink-0 !min-h-11 !px-4" type="submit" disabled={!connected || !text.trim()} aria-label={lang === "ro" ? "Trimite mesajul" : "Send message"}>
            {lang === "ro" ? "Trimite" : "Send"}
          </button>
        </form>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {newBelow > 0 ? (lang === "ro" ? `${newBelow} mesaje noi în chat.` : `${newBelow} new chat messages.`) : ""}
        </p>
      </aside>
    </>
  );
}
