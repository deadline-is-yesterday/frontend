import { Database, Table as TableIcon } from 'lucide-react';

export default function ChiefView() {
  return (
    <div className="flex h-full bg-slate-100">
      <div className="flex-1 p-4 flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Аналитика и учет (Штаб)
            </h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                Экспорт сводки
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">Всего техники на месте</div>
                <div className="text-3xl font-light text-slate-800">4</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">Общий запас воды</div>
                <div className="text-3xl font-light text-slate-800">12.5 <span className="text-lg text-slate-400">т</span></div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">Развернуто рукавов</div>
                <div className="text-3xl font-light text-slate-800">120 <span className="text-lg text-slate-400">м</span></div>
              </div>
            </div>
            
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-slate-500" />
              Журнал учета сил и средств
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Подразделение</th>
                    <th className="px-4 py-3 font-medium">Техника</th>
                    <th className="px-4 py-3 font-medium">Прибытие</th>
                    <th className="px-4 py-3 font-medium">Задача</th>
                    <th className="px-4 py-3 font-medium">Остаток воды</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-3 text-slate-800">1 ПСЧ</td>
                    <td className="px-4 py-3 text-slate-600">АЦ-3,2-40</td>
                    <td className="px-4 py-3 text-slate-600">12:15</td>
                    <td className="px-4 py-3 text-slate-600">Защита смежных помещений</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{width: '80%'}}></div></div>
                        <span className="text-xs text-slate-500">80%</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-800">2 ПСЧ</td>
                    <td className="px-4 py-3 text-slate-600">АЦ-5,0-40</td>
                    <td className="px-4 py-3 text-slate-600">12:22</td>
                    <td className="px-4 py-3 text-slate-600">Установка на ПГ-1</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div></div>
                        <span className="text-xs text-slate-500">100%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
