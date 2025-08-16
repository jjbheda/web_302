// src/pages/CozeHomeRunner.js
import React, { useRef, useState } from "react";
import "./CozeRunner.css";

export default function CozeHomeRunner() {
  const REVEAL_INTERVAL_MS = 60;
  const MIN_CHUNK_CHARS = 24;
  const MAX_CHUNK_CHARS = 64;
  const DEBUG = true;

  const [homeUrl, setHomeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [chunks, setChunks] = useState([]);
  const [streamRaw, setStreamRaw] = useState("");

  const abortRef = useRef(null);
  const fullTextRef = useRef("");
  const queueRef = useRef([]);
  const tickingRef = useRef(false);

  const nextPaint = () => new Promise(requestAnimationFrame);

  function tryJSON(str) {
    if (typeof str !== "string") return str;
    const s = str.trim();
    if (!s || (!s.startsWith("{") && !s.startsWith("["))) return str;
    try { return JSON.parse(s); } catch { return str; }
  }

  function sliceTextIntoChunks(text) {
    if (!text) return [];
    const parts = text.split(/([。！？!?；;…\n\r])/);
    const segs = [];
    for (let i = 0; i < parts.length; i += 2) {
      const content = parts[i] || "";
      const sep = parts[i + 1] || "";
      const piece = content + sep;
      if (!piece) continue;

      if (piece.length <= MAX_CHUNK_CHARS) {
        segs.push(piece);
      } else {
        let tmp = piece;
        const softChars = /([，,、\s])/;
        while (tmp.length > MAX_CHUNK_CHARS) {
          const slice = tmp.slice(0, MAX_CHUNK_CHARS);
          const lastSpace = slice.lastIndexOf(" ");
          const softMatch = slice.search(softChars) >= 0 ? slice.lastIndexOf(slice.match(softChars)?.[0] || "") : -1;
          const pos = Math.max(lastSpace, softMatch);
          if (pos > MIN_CHUNK_CHARS) {
            segs.push(slice.slice(0, pos + 1));
            tmp = tmp.slice(pos + 1);
          } else {
            segs.push(slice);
            tmp = tmp.slice(MAX_CHUNK_CHARS);
          }
        }
        if (tmp) segs.push(tmp);
      }
    }
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const cur = segs[i];
      if (cur.length < MIN_CHUNK_CHARS && i < segs.length - 1) {
        merged.push(cur + segs[++i]);
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function lcp(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
  }

  function enqueueNewDelta(newFull) {
    const prev = fullTextRef.current;
    const start = lcp(prev, newFull);
    const delta = newFull.slice(start);
    if (!delta) return;
    const segs = sliceTextIntoChunks(delta);
    if (segs.length) {
      queueRef.current.push(...segs);
      fullTextRef.current = newFull;
      startRevealLoop();
    }
  }

  function startRevealLoop() {
    if (tickingRef.current) return;
    tickingRef.current = true;
    const tick = () => {
      if (queueRef.current.length === 0) {
        tickingRef.current = false;
        return;
      }
      const next = queueRef.current.shift();
      setChunks((arr) => [...arr, next]);
      setTimeout(tick, REVEAL_INTERVAL_MS);
    };
    setTimeout(tick, REVEAL_INTERVAL_MS);
  }

  function extractPayload(dataObj) {
    let inner = dataObj?.content ?? dataObj?.cotent ?? "";
    inner = tryJSON(inner);
    const _title = inner?.title ?? dataObj?.title ?? "";
    let _text = inner?.cotent ?? inner?.content ?? inner ?? "";
    if (typeof _text !== "string") {
      try { _text = JSON.stringify(_text, null, 2); } catch {}
    }
    return { title: _title, text: _text };
  }

  async function handleRunStream(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTitle("");
    setChunks([]);
    setStreamRaw("");
    fullTextRef.current = "";
    queueRef.current = [];
    tickingRef.current = false;

    try { new URL(homeUrl); } catch { setLoading(false); setError("请输入有效的 home_url"); return; }

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch("http://localhost:3000/api/coze/home/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_url: homeUrl,
          // 可选覆盖：
          // workflow_id: "7538006170724941870",
          // bot_id: "7342*********",
          // app_id: "7439*********",
        }),
        signal: ac.signal,
      });
      if (!r.ok) {
        const maybe = await r.json().catch(() => ({}));
        throw new Error(maybe?.error || r.statusText);
      }

      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("当前环境不支持可读流");

      let buffer = "";

      const flushFrame = async (frame) => {
        if (!frame.trim()) return;
        if (DEBUG) setStreamRaw((s) => s + frame + "\n\n");

        const lines = frame.split(/\r?\n/);
        let eventName = "message";
        const dataLines = [];
        for (const ln of lines) {
          if (ln.startsWith("event:")) eventName = ln.slice(6).trim();
          else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trim());
        }

        const dataStr = dataLines.join("\n");
        const dataObj = tryJSON(dataStr);

        switch (eventName) {
          case "PING":
            break;
          case "Error":
          case "error":
            setError(dataObj?.error_message || dataObj?.message || "上游错误");
            await nextPaint();
            break;
          case "Done":
          case "done":
            await nextPaint(); // 不在 Done 时中断，等 EOF
            break;
          default: {
            const { title: t, text } = extractPayload(
              (eventName === "Message" || eventName === "message") ? dataObj :
              (typeof dataObj === "object" ? dataObj : { content: dataStr })
            );
            if (t) setTitle(t);
            if (text) enqueueNewDelta(text);
            await nextPaint();
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) { if (buffer) await flushFrame(buffer); break; }
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";
        for (const fr of frames) await flushFrame(fr);
      }
    } catch (err) {
      if (err && err.name !== "AbortError") setError(err.message || "流式请求失败");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
  }

  return (
    <main className="coze-wrap">
      <h1 className="coze-title">主页抓取工作流（流式）</h1>
      <p className="coze-subtitle">输入抖音主页链接，分段显示工作流输出。</p>

      <form className="coze-form" onSubmit={handleRunStream}>
        <input
          className="coze-input"
          type="url"
          required
          placeholder="https://www.douyin.com/user/..."
          value={homeUrl}
          onChange={(e) => setHomeUrl(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="coze-btn" type="submit" disabled={loading}>
            {loading ? "运行中…" : "开始流式"}
          </button>
          <button className="coze-btn" type="button" onClick={handleCancel} disabled={!abortRef.current}>
            取消
          </button>
        </div>
      </form>

      {error && <div className="coze-error">错误：{error}</div>}

      {title && (
        <section className="coze-card" style={{ marginTop: 12 }}>
          <p><b>标题：</b>{title}</p>
        </section>
      )}

      <section className="coze-card" style={{ marginTop: 12 }}>
        <h3>正文</h3>
        <div className="coze-result">{chunks.join("")}</div>
      </section>

      {DEBUG && streamRaw && (
        <section className="coze-card">
          <h3>原始事件（调试）</h3>
          <pre className="coze-result" style={{ maxHeight: 260, overflow: "auto" }}>
            {streamRaw}
          </pre>
        </section>
      )}
    </main>
  );
}
