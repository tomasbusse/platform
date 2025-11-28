import React from 'react';
import { User, Company } from '../types';

interface MaterialNotificationsProps {
  currentUser: User | null;
  company: Company | null;
}

const MaterialNotifications: React.FC<MaterialNotificationsProps> = ({
  currentUser,
  company,
}) => {
  if (!currentUser || !company) {
    return null;
  }

  // Materials notifications temporarily disabled
  return null;
};

export default MaterialNotifications;
