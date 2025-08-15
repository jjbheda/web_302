// src/pages/Home.js
import "./Home.css";

export default function Home() {
  return (
    <main className="wrap">
      <header className="header">
        <div>
          <div className="title">聚合入口</div>
          <div className="subtitle">四个选项卡 · 点击跳转 · 自适应布局</div>
        </div>
      </header>

      {/* ✅ 使用说明：
          1) 将下面四个 <a> 的 href 替换为你的真实链接；
          2) 默认新开标签页（target="_blank"），想本页打开改为 "_self"；
      */}
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
        <a
          className="tab"
          href="https://example.com/agent-c"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon" aria-hidden="true">📚</span>
          <span className="name">知识库·Agent C</span>
          <span className="desc">你的知识库或教程页。</span>
        </a>

        {/* 选项卡 4 */}
        <a
          className="tab"
          href="https://example.com/agent-d"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon" aria-hidden="true">🧭</span>
          <span className="name">导航页·Agent D</span>
          <span className="desc">更多链接与分类导航。</span>
        </a>
      </section>

      <footer className="footer">
       
      </footer>
    </main>
  );
}
