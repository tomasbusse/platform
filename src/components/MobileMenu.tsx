import React, { useEffect } from 'react';

interface NavItem {
  id: string;
  name: string;
  icon: React.FC;
  show: boolean;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: {
    name: string;
    role: string;
  } | null;
  onLogout: () => void;
  getRoleDisplayName: (role: string) => string;
}

// Icons for settings and logout
const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  navItems,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  getRoleDisplayName,
}) => {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    onClose();
  };

  const handleSettingsClick = () => {
    setActiveTab('settings');
    onClose();
  };

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-simmonds-charcoal/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Full-screen menu */}
      <div className="fixed inset-0 bg-simmonds-cream-lighter flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-simmonds-cream">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-simmonds-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="text-simmonds-primary font-bold text-lg">Simmonds</h1>
              <p className="text-simmonds-stone text-xs">Language Services</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-simmonds-cream transition-colors text-simmonds-charcoal"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 text-lg ${
                    activeTab === item.id
                      ? 'bg-simmonds-primary text-white font-medium'
                      : 'text-simmonds-primary hover:bg-simmonds-cream active:bg-simmonds-cream'
                  }`}
                >
                  <span className="w-6 h-6">
                    <Icon />
                  </span>
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer - User Info & Actions */}
        <div className="p-4 border-t border-simmonds-cream space-y-2 bg-simmonds-cream-lighter">
          {/* Settings */}
          <button
            onClick={handleSettingsClick}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 text-lg ${
              activeTab === 'settings'
                ? 'bg-simmonds-primary text-white font-medium'
                : 'text-simmonds-primary hover:bg-simmonds-cream active:bg-simmonds-cream'
            }`}
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>

          {/* User Info */}
          {currentUser && (
            <div className="px-4 py-3 bg-white rounded-xl">
              <p className="text-simmonds-charcoal font-medium">{currentUser.name}</p>
              <p className="text-simmonds-stone text-sm">{getRoleDisplayName(currentUser.role)}</p>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-simmonds-terracotta hover:bg-simmonds-terracotta/10 active:bg-simmonds-terracotta/20 transition-all duration-200 text-lg"
          >
            <LogoutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
