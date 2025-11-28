import React from 'react';
import { Id } from '../../convex/_generated/dataModel';

interface MaterialDownloadStatsProps {
  materialId: Id<"lessonMaterials">;
}

const MaterialDownloadStats: React.FC<MaterialDownloadStatsProps> = ({ materialId }) => {
  // Materials stats feature temporarily disabled
  return null;
};

export default MaterialDownloadStats;
