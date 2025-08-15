import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CozeRunner from "./pages/CozeRunner"; // 或 CozeRunner.js

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/coze-runner" element={<CozeRunner />} />
      </Routes>
    </Router>
  );
}

export default App;
