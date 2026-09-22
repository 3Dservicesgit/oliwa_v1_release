/**
 * WaswaDrawer — Waswa AI Co-Pilot Chat Drawer
 *
 * Slides in from the right as an overlay when opened. Talks to the real
 * assistant: POST /assistant/chat (surface "oliwa_console") and
 * POST /assistant/feedback.
 *
 *   Header:  "Waswa AI • Co-Pilot Chat" + ON/OFF toggle
 *   Body:    AI (left, grey bubble) + user (right, green bubble). AI answers
 *            show a "Verified" chip when a 3D Services-approved answer was
 *            used, and Helpful / Wrong buttons. "Wrong" goes to the review
 *            queue in the CMS, where staff correct Waswa.
 *   Chips:   quick prompts (sent as a message unless the caller passes onClick)
 *   Footer:  input + send
 *
 * Conversation threading: the conversation_uid returned by the first reply is
 * sent back with every later message, so the backend keeps one conversation.
 *
 * Normally mounted once, by WaswaProvider, for the whole console. `pendingPrompt`
 * lets any page ask a question through it (an "Ask Waswa" box, a suggestion
 * chip); `moduleName` tells Waswa which screen the question came from.
 *
 * All styles: Tailwind utility classes only.
 */
import React, { useState, useRef, useEffect } from "react";
import { sendWaswaMessage, sendWaswaFeedback } from "../../api/services/waswa.service";
import type { WaswaVerdict, WaswaVerifiedRef } from "../../api/types";

export interface ChatMessage {
  id:          string;
  role:        "ai" | "user";
  text:        string;
  messageUid?: string | null;
  verified?:   WaswaVerifiedRef[];
  error?:      boolean;
  /** The question that failed, so it can be sent again. */
  retryText?:  string;
  feedback?:   WaswaVerdict;
}

interface WaswaDrawerProps {
  open:     boolean;
  onClose:  () => void;
  waswaOn?: boolean;
  onToggleWaswa?: () => void;
  quickActions?: { id: string; label: string; onClick?: () => void }[];
  /** Ask this as soon as it changes (nonce) and the drawer is open. */
  pendingPrompt?: { text: string; nonce: number } | null;
  /** The console screen the user is on — sent with each question as context. */
  moduleName?: string | null;
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "ai",
  text: "Hi, I'm Waswa. Ask me about your vehicles, tokens, trips or how OLIWA works. "
      + "If an answer is wrong, tap Wrong and our team will correct it.",
};

const DEFAULT_QUICK_ACTIONS = [
  { id: "balance", label: "How many tokens do I have?"    },
  { id: "offline", label: "Why is a vehicle offline?"      },
  { id: "tokens",  label: "How do tracking tokens work?"  },
];

function errorText(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return "Waswa could not be reached. Please try again.";
}

export function WaswaDrawer({
  open,
  onClose,
  waswaOn       = true,
  onToggleWaswa,
  quickActions  = DEFAULT_QUICK_ACTIONS,
  pendingPrompt = null,
  moduleName    = null,
}: WaswaDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [conversationUid, setConversationUid] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);   // message id
  const [flagNote, setFlagNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, sending]);

  /** Ask a question. With `retryOf`, re-ask one that failed: the error bubble
   *  is removed and the question isn't shown twice. */
  const send = async (raw: string, retryOf?: string) => {
    const text = raw.trim();
    if (!text || sending || !waswaOn) return;
    const id = `m${Date.now()}`;
    setMessages((prev) => retryOf
      ? prev.filter((m) => m.id !== retryOf)
      : [...prev, { id, role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res = await sendWaswaMessage({
        message: text,
        conversation_uid: conversationUid,
        module: moduleName ?? undefined,
      });
      const data = res.data;
      if (data.conversation_uid) setConversationUid(data.conversation_uid);
      setMessages((prev) => [...prev, {
        id: `${id}-reply`,
        role: "ai",
        text: data.reply,
        messageUid: data.message_uid,
        verified: data.verified_answers ?? [],
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `${id}-err`, role: "ai", text: errorText(err), error: true, retryText: text,
      }]);
    } finally {
      setSending(false);
    }
  };

  // A question asked from elsewhere on the page. The latest send is kept in a
  // ref so this effect runs once per prompt, not on every render.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const handledNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !pendingPrompt || handledNonce.current === pendingPrompt.nonce) return;
    if (!waswaOn || sending) return;         // retried when these change
    handledNonce.current = pendingPrompt.nonce;
    void sendRef.current(pendingPrompt.text);
  }, [open, pendingPrompt, waswaOn, sending]);

  const rate = async (msg: ChatMessage, verdict: WaswaVerdict, note?: string) => {
    if (!msg.messageUid) return;
    try {
      await sendWaswaFeedback({ message_uid: msg.messageUid, verdict, note });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, feedback: verdict } : m)));
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `fb${Date.now()}`, role: "ai", text: `Feedback not saved: ${errorText(err)}`, error: true,
      }]);
    } finally {
      setFlagging(null);
      setFlagNote("");
    }
  };

  const newChat = () => {
    setMessages([GREETING]);
    setConversationUid(null);
    setFlagging(null);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[299] bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 bottom-0 z-[300]
          w-full max-w-[400px]
          bg-white border-l border-[#E9EDEF]
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open
            ? "translate-x-0 shadow-[-8px_0_40px_rgba(0,0,0,0.15)]"
            : "translate-x-full shadow-none pointer-events-none"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#075E54] text-white shrink-0">
          <div className="min-w-0">
            <div className="font-black text-[14px]">Waswa AI • Co-Pilot Chat</div>
            {moduleName && <div className="text-[10px] opacity-70 truncate">Context: {moduleName}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={newChat}
              title="Start a new conversation"
              className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-black text-white border-none cursor-pointer"
            >
              New
            </button>
            <button
              onClick={onToggleWaswa}
              aria-pressed={waswaOn}
              className={`
                h-7 min-w-[44px] px-3 rounded-full border-none text-[11px] font-black
                cursor-pointer transition-all
                ${waswaOn ? "bg-[#25D366] text-white" : "bg-white/20 text-white/60"}
              `}
            >
              {waswaOn ? "ON" : "OFF"}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors grid place-items-center text-white border-none cursor-pointer text-[14px]"
            >
              ✕
            </button>
          </div>
        </div>

        {!waswaOn && (
          <div className="px-4 py-2 bg-[#FFFBEB] border-b border-[#FDE68A] text-[12px] text-[#92400E] shrink-0">
            Waswa is switched off. Press <b>OFF</b> above to switch it on
            {pendingPrompt && handledNonce.current !== pendingPrompt.nonce ? " — your question will be sent then." : "."}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap
                  ${msg.role === "user"
                    ? "bg-[#25D366] text-white rounded-br-sm"
                    : msg.error
                      ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded-bl-sm"
                      : "bg-[#F0F2F5] text-[#111B21] rounded-bl-sm"
                  }
                `}
              >
                {msg.verified && msg.verified.length > 0 && (
                  <span className="inline-block mb-1 mr-1 rounded-full bg-[#DCFCE7] text-[#166534] text-[10px] font-extrabold px-2 py-0.5">
                    ✓ Verified answer
                  </span>
                )}
                {msg.text}
              </div>

              {msg.error && msg.retryText && (
                <button
                  onClick={() => send(msg.retryText!, msg.id)}
                  disabled={sending || !waswaOn}
                  className="mt-1 h-6 px-2.5 rounded-full border border-[#FECACA] bg-white text-[#B91C1C] text-[10px] font-bold cursor-pointer hover:bg-[#FEF2F2] disabled:opacity-50 disabled:cursor-default"
                >
                  Try again
                </button>
              )}

              {/* Rate an AI answer */}
              {msg.role === "ai" && msg.messageUid && !msg.error && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                  {msg.feedback ? (
                    <span className="text-[#667781] font-bold">
                      {msg.feedback === "good" ? "Thanks — marked helpful" : "Flagged for review"}
                    </span>
                  ) : flagging === msg.id ? null : (
                    <>
                      <button
                        onClick={() => rate(msg, "good")}
                        className="h-6 px-2 rounded-full border border-[#E9EDEF] bg-white text-[#667781] font-bold cursor-pointer hover:bg-[#F0F2F5]"
                      >
                        Helpful
                      </button>
                      <button
                        onClick={() => { setFlagging(msg.id); setFlagNote(""); }}
                        className="h-6 px-2 rounded-full border border-[#FECACA] bg-white text-[#B91C1C] font-bold cursor-pointer hover:bg-[#FEF2F2]"
                      >
                        Wrong
                      </button>
                    </>
                  )}
                </div>
              )}

              {flagging === msg.id && (
                <div className="w-[85%] mt-1.5 flex flex-col gap-1.5">
                  <textarea
                    value={flagNote}
                    onChange={(e) => setFlagNote(e.target.value)}
                    rows={2}
                    placeholder="What's wrong, or what should it have said? (optional)"
                    className="w-full rounded-lg border border-[#E9EDEF] bg-[#F8F9FA] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#128C7E] resize-none"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => setFlagging(null)}
                      className="h-7 px-3 rounded-full border border-[#E9EDEF] bg-white text-[11px] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => rate(msg, "wrong", flagNote)}
                      className="h-7 px-3 rounded-full border-none bg-[#EF4444] text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      Send flag
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-[#F0F2F5] px-3.5 py-2.5 text-[12px] text-[#667781]">
                Waswa is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0 border-t border-[#E9EDEF] pt-3">
          <div className="text-[10px] font-extrabold text-[#667781] uppercase tracking-wide w-full mb-1">
            Try asking
          </div>
          {quickActions.map((a) => (
            <button
              key={a.id}
              onClick={a.onClick ?? (() => send(a.label))}
              disabled={sending || !waswaOn}
              className="h-8 px-3 rounded-full text-[11px] font-extrabold border border-[#E9EDEF] bg-white text-[#111B21] cursor-pointer hover:bg-[#F0F2F5] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-default"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Chat input */}
        <div className="flex gap-2 px-4 py-3 border-t border-[#E9EDEF] shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            disabled={!waswaOn}
            placeholder={waswaOn ? "Ask Waswa…" : "Waswa is off"}
            className="
              flex-1 min-w-0 h-10 rounded-xl border border-[#E9EDEF]
              bg-[#F8F9FA] px-3 text-[12px] outline-none
              focus:border-[#128C7E] transition-colors disabled:opacity-60
            "
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !waswaOn || !input.trim()}
            aria-label="Send"
            className="
              w-10 h-10 rounded-xl border-none shrink-0
              bg-[#25D366] text-[#075E54] font-black text-[14px]
              cursor-pointer hover:brightness-105 active:opacity-85 transition-all
              grid place-items-center disabled:opacity-50 disabled:cursor-default
            "
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
