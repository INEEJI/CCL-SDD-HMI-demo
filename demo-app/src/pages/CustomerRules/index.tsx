import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { mockCustomers, Rule } from '../../constants/mockCustomerRules';
import type { Customer } from '../../constants/mockCustomerRules';
import { List, Settings, Save, Bell } from 'lucide-react';

const CustomerRules: React.FC = () => {
  const [customers] = useState<Customer[]>(mockCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    // 실제라면 API로 고객사별 규칙을 가져옵니다. 지금은 목 데이터를 사용합니다.
    setRules(customer.rules);
  };

  const handleRuleChange = (index: number, field: keyof Rule, value: string | number | boolean) => {
    const updatedRules = [...rules];
    const targetRule = { ...updatedRules[index] };

    // 타입에 맞게 값 변환
    if (field === 'sensitivity' || field === 'minSize') {
      targetRule[field] = Number(value);
    } else if (field === 'notify') {
      targetRule[field] = Boolean(value);
    }

    updatedRules[index] = targetRule;
    setRules(updatedRules);
  };

  const handleSaveChanges = () => {
    if (!selectedCustomer) return;
    console.log(`${selectedCustomer.name}의 규칙 저장:`, rules);
    toast.success(`${selectedCustomer.name}의 기준 설정이 저장되었습니다.`);
  };
  
  const Panel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-surface border border-border rounded-xl shadow-main backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
      <h1 className="text-3xl font-bold text-text-primary tracking-tight">고객사 기준 정보</h1>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <Panel className="lg:col-span-1 p-6">
          <div className="flex items-center space-x-3 mb-4 border-b border-border pb-4">
            <List className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">고객사 목록</h2>
          </div>
          <ul className="space-y-2">
            {customers.map(customer => (
              <li
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 font-medium text-sm ${
                  selectedCustomer?.id === customer.id
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                }`}
              >
                {customer.name}
              </li>
            ))}
          </ul>
        </Panel>

        {/* Rules Form */}
        <Panel className="lg:col-span-2 p-6">
          {selectedCustomer ? (
            <div>
              <div className="flex items-center space-x-3 mb-4 border-b border-border pb-4">
                <Settings className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold text-text-primary">
                  {selectedCustomer.name} - 기준 설정
                </h2>
              </div>
              <div className="space-y-6 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                {rules.map((rule, index) => (
                  <div key={rule.defectType} className="p-4 bg-surface-elevated rounded-lg border border-border">
                    <h3 className="text-lg font-semibold text-primary mb-4">{rule.defectType}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">민감도: <span className="font-bold text-primary">{rule.sensitivity}%</span></label>
                        <input
                          type="range"
                          min="0" max="100"
                          value={rule.sensitivity}
                          onChange={(e) => handleRuleChange(index, 'sensitivity', e.target.value)}
                          className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer slider"
                          style={{ background: `linear-gradient(to right, #58A6FF 0%, #58A6FF ${rule.sensitivity}%, #30363D ${rule.sensitivity}%, #30363D 100%)` }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">최소 크기 (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={rule.minSize}
                          onChange={(e) => handleRuleChange(index, 'minSize', e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center">
                         <input
                            id={`notify-${index}`}
                            type="checkbox"
                            checked={rule.notify}
                            onChange={(e) => handleRuleChange(index, 'notify', e.target.checked)}
                            className="h-4 w-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
                          />
                        <label htmlFor={`notify-${index}`} className="ml-2 block text-sm font-medium text-text-primary">실시간 알림</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-right">
                <button
                  onClick={handleSaveChanges}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-500 transition-colors shadow-lg"
                >
                  <Save className="h-4 w-4"/>
                  변경사항 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <List className="mx-auto h-12 w-12 text-text-secondary/50"/>
                <p className="mt-4 text-text-secondary text-lg">왼쪽 목록에서 고객사를 선택하세요.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default CustomerRules;