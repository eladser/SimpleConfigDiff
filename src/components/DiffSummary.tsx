import { ComparisonResult } from '@/types';
import { Plus, Minus, RefreshCw, BarChart3 } from 'lucide-react';

interface DiffSummaryProps {
  result: ComparisonResult;
}

export function DiffSummary({ result }: DiffSummaryProps) {
  const { summary } = result;
  
  const summaryItems = [
    {
      label: 'Added',
      value: summary.added,
      icon: Plus,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
      borderColor: 'border-success-200'
    },
    {
      label: 'Removed',
      value: summary.removed,
      icon: Minus,
      color: 'text-danger-600',
      bgColor: 'bg-danger-50',
      borderColor: 'border-danger-200'
    },
    {
      label: 'Changed',
      value: summary.changed,
      icon: RefreshCw,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
      borderColor: 'border-warning-200'
    },
    {
      label: 'Total',
      value: summary.total,
      icon: BarChart3,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-200'
    }
  ];
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Comparison Summary
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={`p-4 rounded-lg border ${item.bgColor} ${item.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {item.label}
                </p>
                <p className={`text-2xl font-bold ${item.color}`}>
                  {item.value}
                </p>
              </div>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
          </div>
        ))}
      </div>
      
      {summary.total > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Changes distribution:
            </span>
            <div className="flex items-center gap-4">
              <span className="text-success-600">
                {((summary.added / summary.total) * 100).toFixed(1)}% added
              </span>
              <span className="text-danger-600">
                {((summary.removed / summary.total) * 100).toFixed(1)}% removed
              </span>
              <span className="text-warning-600">
                {((summary.changed / summary.total) * 100).toFixed(1)}% changed
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}