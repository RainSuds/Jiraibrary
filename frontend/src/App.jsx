import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Catalog from './pages/Catalog';
import ItemDetail from './pages/ItemDetail';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-jirai-white to-pink-50">
        <nav className="bg-jirai-black text-white shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="text-2xl font-bold text-jirai-pink hover:text-pink-300 transition">
                💗 Jiraibrary
              </Link>
              <div className="space-x-6">
                <Link to="/" className="hover:text-jirai-pink transition">
                  Catalog
                </Link>
                <Link to="/admin" className="hover:text-jirai-pink transition">
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

        <footer className="bg-jirai-black text-white mt-16 py-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm">
              💗 Jiraibrary - Your Jirai Kei Fashion Database 💗
            </p>
            <p className="text-xs mt-2 text-gray-400">
              Built with React, Express, and SQLite
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
