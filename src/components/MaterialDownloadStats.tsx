import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface MaterialDownloadStatsProps {
  materialId: Id<"lessonMaterials">;
}

const MaterialDownloadStats: React.FC<MaterialDownloadStatsProps> = ({ materialId }) => {
  const stats = useQuery(api.materials.getMaterialDownloadStats, {
    materialId,
  });

  if (!stats) {
    return <div className="text-sm text-gray-500">Loading stats...</div>;
  }

  return (
    <div className="bg-gradient-to-br from-simmonds-primary/5 to-simmonds-primary/10 rounded-lg p-4 border border-simmonds-primary/20">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">📊 Download Statistics</h4>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded p-3 border border-simmonds-primary/10">
          <p className="text-xs text-gray-600 mb-1">Total Downloads</p>
          <p className="text-2xl font-bold text-simmonds-primary">{stats.totalDownloads}</p>
        </div>

        <div className="bg-white rounded p-3 border border-simmonds-primary/10">
          <p className="text-xs text-gray-600 mb-1">Unique Users</p>
          <p className="text-2xl font-bold text-simmonds-primary">{stats.uniqueUsers}</p>
        </div>
      </div>

      {stats.lastDownloadedAt && (
        <p className="text-xs text-gray-600">
          Last downloaded:{' '}
          <span className="font-medium">
            {new Date(stats.lastDownloadedAt).toLocaleDateString()} at{' '}
            {new Date(stats.lastDownloadedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>
      )}

      {stats.downloads && stats.downloads.length > 0 && (
        <div className="mt-4 pt-4 border-t border-simmonds-primary/20">
          <p className="text-xs font-semibold text-gray-900 mb-2">Recent Downloads</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {stats.downloads.slice(0, 5).map((download: any, idx: number) => (
              <div key={idx} className="text-xs text-gray-600 flex justify-between">
                <span>User {download.userId.substring(0, 8)}...</span>
                <span className="text-gray-500">
                  {new Date(download.downloadedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialDownloadStats;

