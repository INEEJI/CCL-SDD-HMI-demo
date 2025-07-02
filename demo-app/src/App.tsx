import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import CustomerRules from './pages/CustomerRules';
import ModelManagement from './pages/ModelManagement';
import Diagnostics from './pages/Diagnostics';
import DataManagement from './pages/DataManagement';

// 각 페이지에 대한 임시 컴포넌트
const NotFound = () => <div className="text-xl font-bold">404 - 페이지를 찾을 수 없습니다.</div>;


function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/rules" element={<CustomerRules />} />
          <Route path="/models" element={<ModelManagement />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
