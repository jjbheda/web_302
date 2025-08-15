import React, { useState } from "react";
import "./CozeRunner.css";

export default function CozeRunner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  async function handleRun(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResp(null);
    try {
      const r = await fetch("/api/coze/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setResp(data);
    } catch (err) {
      setError(err.message || "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="coze-wrap">
      <h1 className="coze-title">Coze 工作流调用</h1>
      <p className="coze-subtitle">
        粘贴一个链接，点击运行。后端将代为调用 Coze API，并把结果返回到此页面。
      </p>

      <form className="coze-form" onSubmit={handleRun}>
        <input
          className="coze-input"
          type="url"
          required
          placeholder="例如：https://www.douyin.com/video/7536..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="coze-btn" type="submit" disabled={loading}>
          {loading ? "运行中…" : "运行"}
        </button>
      </form>

      {error && <div className="coze-error">错误：{error}</div>}

      {resp && (
        <pre className="coze-result">
{JSON.stringify(resp, null, 2)}
        </pre>
      )}
    </main>
  );
}
