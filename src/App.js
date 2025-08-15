// src/App.js
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";

function Nav() {
  return (
    <nav style={{ padding: 10, background: "#f5f5f5" }}>
      <Link to="/" style={{ marginRight: 10 }}>首页</Link>
      {/* 需要更多内部页面，可在这里继续加 Link + Route */}
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
}
