import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import POS from './pages/POS';
import CompleteOrder from './pages/CompleteOrder';
import { addOnlineListener } from './utils/onlineStatus';
import { performAutoSync } from './services/syncService';
import './App.css';

function SyncWhenOnline() {
  useEffect(() => {
    const removeOnline = addOnlineListener(async () => {
      try {
        await performAutoSync();
      } catch (error) {
        console.error('Sync when online failed:', error);
      }
    });
    return () => removeOnline();
  }, []);
  return null;
}

function App() {
  return (
    <Router>
      <SyncWhenOnline />
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
