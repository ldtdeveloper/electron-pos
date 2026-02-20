import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import POS from './pages/POS';
import CompleteOrder from './pages/CompleteOrder';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/complete-order" element={<CompleteOrder />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
