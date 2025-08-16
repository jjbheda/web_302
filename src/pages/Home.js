// src/pages/Home.js
import "./Home.css";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="wrap">
      <header className="header">
        <div>
          <div className="title">聚合入口</div>
          <div className="subtitle">四个选项卡 · 点击跳转 · 自适应布局</div>
        </div>
      </header>

      <section className="grid" role="navigation" aria-label="聚合入口">
        {/* 选项卡 1 */}
        <a
          className="tab"
          href="https://xy4d-chat.302.ai/#/chat?confirm=true&region=1&lang=zh-CN&is_gpts=false&mode=agent-test"
          rel="noopener noreferrer"
        >
          <span className="icon" aria-hidden="true">🤖</span>
          <span className="name">智能体·Agent A</span>
          <span className="desc">示例：跳转到你的智能体页面。</span>
        </a>

        {/* 选项卡 2 */}
        <a
          className="tab"
          href="https://example.com/agent-b"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon" aria-hidden="true">⚡</span>
          <span className="name">工具集·Agent B</span>
          <span className="desc">放常用工具或业务入口。</span>
        </a>

        {/* 选项卡 3 */}
        <Link
          className="tab"
            to="/douyin-homepage"
        >
          <span className="icon" aria-hidden="true">📚</span>
          <span className="name">网络大V首页分析</span>
          <span className="desc">一键分析对标账户</span>
        </Link>

        {/* 选项卡 4 -> 改为跳 CozeRunner 页面 */}
        <Link
          className="tab"
          to="/coze-runner"
        >
          <span className="icon" aria-hidden="true">🧭</span>
          <span className="name">一键提取抖音爆款内容</span>
          <span className="desc">输入链接调用 API 并展示结果。</span>
        </Link>
      </section>

      <footer className="footer">
        {/* 这里可以加版权信息或其他内容 */}
      </footer>
    </main>
  );
}
