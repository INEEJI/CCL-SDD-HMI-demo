import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
}

interface DefectRule {
  defectType: string;
  sensitivity: number;
  minSize: number;
  notify: boolean;
}

const CustomerRules: React.FC = () => {
  const [customers] = useState<Customer[]>([
    { id: '1', name: '현대제철' },
    { id: '2', name: 'POSCO' },
    { id: '3', name: '동국제강' },
    { id: '4', name: '세아제강' },
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editedRules, setEditedRules] = useState<DefectRule[]>([]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    // 선택된 고객사의 기본 규칙으로 초기화
    const defaultRules = [
      { defectType: 'Scratch', sensitivity: 80, minSize: 0.5, notify: true },
      { defectType: 'Dent', sensitivity: 70, minSize: 1.0, notify: true },
      { defectType: 'Scale', sensitivity: 60, minSize: 0.8, notify: false },
      { defectType: 'Pin hole', sensitivity: 90, minSize: 0.3, notify: true },
    ];
    setEditedRules([...defaultRules]);
  };

  const handleRuleChange = (index: number, field: keyof DefectRule, value: string | number | boolean) => {
    const updatedRules = [...editedRules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    setEditedRules(updatedRules);
  };

  const handleSaveChanges = () => {
    if (!selectedCustomer) return;
    
    // 실제로는 API 호출을 통해 서버에 저장
    console.log(`${selectedCustomer.name}의 규칙 저장:`, editedRules);
    toast.success(`${selectedCustomer.name}의 기준 설정이 저장되었습니다.`);
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-2xl font-bold text-dark mb-4">고객사별 기준 설정</h1>
      <div className="flex-1 flex gap-6">
        {/* Customer List */}
        <div className="w-1/4 bg-surface p-4 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-dark">고객사 목록</h2>
          <ul className="space-y-2">
            {customers.map(customer => (
              <li
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className={`p-3 rounded-lg cursor-pointer transition-colors font-medium ${
                  selectedCustomer?.id === customer.id
                    ? 'bg-accent text-white shadow'
                    : 'text-muted hover:bg-background hover:text-dark'
                }`}
              >
                {customer.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Rules Form */}
        <div className="flex-1 bg-surface p-6 rounded-xl shadow-lg">
          {selectedCustomer ? (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-dark">
                {selectedCustomer.name} - 기준 설정
              </h2>
              <div className="space-y-6">
                {editedRules.map((rule, index) => (
                  <div key={rule.defectType} className="p-4 border border-gray-200 rounded-lg bg-background">
                    <h3 className="text-lg font-semibold text-secondary mb-3">{rule.defectType}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted mb-1">민감도: <span className="font-bold text-accent">{rule.sensitivity}%</span></label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={rule.sensitivity}
                          onChange={(e) => handleRuleChange(index, 'sensitivity', e.target.value)}
                          className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-highlight"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted mb-1">최소 크기 (mm)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={rule.minSize}
                          onChange={(e) => handleRuleChange(index, 'minSize', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
                        />
                      </div>
                      <div className="flex items-center md:col-start-3 md:justify-self-end">
                         <input
                            id={`notify-${index}`}
                            type="checkbox"
                            checked={rule.notify}
                            onChange={(e) => handleRuleChange(index, 'notify', e.target.checked)}
                            className="h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent"
                          />
                        <label htmlFor={`notify-${index}`} className="ml-2 block text-sm font-medium text-dark">실시간 알림 받기</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-right">
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-highlight transition-colors shadow-md"
                >
                  변경사항 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-xl">왼쪽 목록에서 고객사를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerRules; 