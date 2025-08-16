import React, { useRef, useState } from "react";
import "./CozeRunner.css";

export default function CozeRunner() {
  // ================ 可调参数 ================
  const REVEAL_INTERVAL_MS = 60;  // 每个片段显示间隔
  const MIN_CHUNK_CHARS = 24;     // 片段最小长度
  const MAX_CHUNK_CHARS = 64;     // 片段最大长度
  const DEBUG = true;

  // ================ UI 状态 ================
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [chunks, setChunks] = useState([]);   // 纯 JS：不写泛型
  const [streamRaw, setStreamRaw] = useState("");

  // ================ 运行期引用 ================
  const abortRef = useRef(null);
  const fullTextRef = useRef("");      // 已累计的完整文本
  const queueRef = useRef([]);         // 待显示片段
  const tickingRef = useRef(false);    // 是否正在逐段显示
  const nodeKeyRef = useRef("");       // 当前节点 key（node_id|node_title）

  // =============== 工具函数：解析 & 切片 ===============
  function tryJSON(str) {
      if (typeof str !== "string") return str;
      const raw = str.trim();
      if (!raw) return str;

      // 先走一次正常解析
      try { return JSON.parse(raw); } catch {}

      // ------ 容错修补：常见的 content 未闭合 ------
      let fixed = raw;

      // 情形A：在 "content":"{...<缺失> 之后，直接出现 ,"content_type"
      // 例： ... "urls":"https://...\"content_type":"text"
      // 把 \\"content_type" 修成 "}","content_type"
      fixed = fixed.replace(/\\"content_type"/, '"},"content_type"');

      // 情形B：更加保守：在 "content":"{ ... } 之前缺了结束引号
      // 把  "content":"{  ... }\"content_type"
      // 修成 "content":"{ ... }","content_type"
      fixed = fixed.replace(
        /"content":"\{([^]*?)\}\\"content_type"/,   // [^]* 跨行匹配
        '"content":"{$1}","content_type"'
      );

      // 还有些返回把 cotent 拼错了（已在 extractPayload 里兼容，这里不处理）

      try { return JSON.parse(fixed); } catch {}
      // 仍解析失败就原样返回，让上层按字符串处理
      return str;
  }

  // 把文本按句子/换行切片；必要时做长度二次切分
  function sliceTextIntoChunks(text) {
    if (!text) return [];
    const parts = text.split(/([。！？!?；;…\n\r])/); // 捕获分隔符
    const segs = [];
    for (let i = 0; i < parts.length; i += 2) {
      const content = parts[i] || "";
      const sep = parts[i + 1] || "";
      const piece = content + sep;
      if (!piece) continue;

      if (piece.length <= MAX_CHUNK_CHARS) {
        segs.push(piece);
      } else {
        // 二次切分，优先软边界
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

    // 合并过短片段，避免太碎
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

  // 最长公共前缀，用来找“新增部分”
  function lcp(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
  }

  // 把新文本的“增量”切片并入队
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

  // 启动逐段显示循环
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

  // =============== 解析 SSE payload ===============
  function extractPayload(dataObj) {
    let inner = dataObj?.content ?? dataObj?.cotent ?? "";
    inner = tryJSON(inner);

    const _title = inner?.title ?? dataObj?.title ?? "";
    const _urls  = inner?.urls  ?? dataObj?.urls  ?? "";
    let   _text  = inner?.cotent ?? inner?.content ?? inner ?? "";

    if (typeof _text !== "string") {
      try { _text = JSON.stringify(_text, null, 2); } catch {}
    }

    return {
      node_id: dataObj?.node_id,
      node_title: dataObj?.node_title,
      node_type: dataObj?.node_type,
      node_is_finish: !!dataObj?.node_is_finish,
      title: _title,
      urls: _urls,
      text: _text,
    };
  }

  function nodeKeyOf(p) {
    return p.node_id || p.node_title || "unknown";
  }

  // =============== 主流程（流式读取） ===============
  async function handleRunStream(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTitle("");
    setLink("");
    setChunks([]);
    setStreamRaw("");
    fullTextRef.current = "";
    queueRef.current = [];
    tickingRef.current = false;
    nodeKeyRef.current = "";

    try {
      new URL(url);
    } catch {
      setLoading(false);
      setError("请输入有效链接");
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;

    const nextPaint = () => new Promise(requestAnimationFrame);

    try {
      const r = await fetch("http://guiqiantec.com:3010/api/coze/run-workflow/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: url /* 如需：, bot_id:'xxx', app_id:'yyy' */ }),
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
        let idStr = null;
        const dataLines = [];
        for (const ln of lines) {
          if (ln.startsWith("event:")) eventName = ln.slice(6).trim();
          else if (ln.startsWith("id:")) idStr = ln.slice(3).trim();
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
            // 不中断，等 EOF
            await nextPaint();
            break;
          default: {
            const parsed = extractPayload(
              (eventName === "Message" || eventName === "message") ? dataObj :
              (typeof dataObj === "object" ? dataObj : { content: dataStr })
            );

            if (parsed.title) setTitle(parsed.title);
            if (parsed.urls)  setLink(parsed.urls);

            const key = nodeKeyOf(parsed);
            // 如果你希望 End 出现时清屏，取消注释下两行：
            // if (nodeKeyRef.current && key !== nodeKeyRef.current && (parsed.node_title || parsed.node_type || "").toLowerCase() === "end") {
            //   setChunks([]); fullTextRef.current = "";
            // }
            nodeKeyRef.current = key;

            const newFull = parsed.text || "";
            if (newFull) enqueueNewDelta(newFull);

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

  // ================== UI ==================
  return (
    <main className="coze-wrap">
      <h1 className="coze-title">Coze 工作流调用（流式分段输出）</h1>
      <p className="coze-subtitle">按句子/标点切片逐段展示；新增内容只追加显示。</p>

      <form className="coze-form" onSubmit={handleRunStream}>
        <input
          className="coze-input"
          type="url"
          required
          placeholder="例如：https://www.douyin.com/video/7522..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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

      {(title || link) && (
        <section className="coze-card" style={{ marginTop: 12 }}>
          {title && <p><b>标题：</b>{title}</p>}
          {link && (
            <p><b>链接：</b>
              <a href={link} target="_blank" rel="noreferrer">{link}</a>
            </p>
          )}
        </section>
      )}
      <section className="coze-card" style={{ marginTop: 12 }}>
        <h3>正文</h3>
        <div className="coze-result">
          {chunks.join("")}
        </div>
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
