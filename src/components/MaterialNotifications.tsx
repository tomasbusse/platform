import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface MaterialNotificationsProps {
  currentUser: User | null;
  company: Company | null;
}

const MaterialNotifications: React.FC<MaterialNotificationsProps> = ({
  currentUser,
  company,
}) => {
  const [showAll, setShowAll] = useState(false);

  if (!currentUser || !company) {
    return null;
  }

  const notifications = useQuery(api.materials.getUserNotifications, {
    userId: currentUser._id,
    companyId: company._id as Id<"companies">,
    unreadOnly: !showAll,
  });

  const markAsRead = useMutation(api.materials.markNotificationAsRead);

  const handleMarkAsRead = async (notificationId: Id<"materialNotifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  if (!notifications || notifications.length === 0) {
    return null;
  }

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📬 Material Updates
          {unreadCount > 0 && (
            <span className="bg-simmonds-primary text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>
        {notifications.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-simmonds-primary hover:underline"
          >
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {notifications.slice(0, showAll ? undefined : 3).map((notification: any) => (
          <div
            key={notification._id}
            className={`p-3 rounded-lg border-l-4 transition-colors ${
              notification.isRead
                ? 'bg-gray-50 border-gray-300'
                : 'bg-simmonds-primary/5 border-simmonds-primary'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {getNotificationIcon(notification.notificationType)} {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(notification.createdAt).toLocaleDateString()} at{' '}
                  {new Date(notification.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {!notification.isRead && (
                <button
                  onClick={() => handleMarkAsRead(notification._id)}
                  className="text-xs px-2 py-1 bg-simmonds-primary text-white rounded hover:bg-simmonds-primary/90 whitespace-nowrap"
                >
                  Mark Read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'material_shared':
      return '📤';
    case 'material_updated':
      return '✏️';
    case 'material_removed':
      return '🗑️';
    default:
      return '📬';
  }
}

export default MaterialNotifications;

