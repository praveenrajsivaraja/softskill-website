
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  applySavedMenuOrder,
  readAdminMenuOrder,
  reorderMenuItems,
  writeAdminMenuOrder,
} from '@/lib/adminMenuOrder';
import {
  hasSeenAdminMenuTour,
  markAdminMenuTourSeen,
  tourStepsForMenu,
} from '@/lib/adminMenuTour';
import AdminMenuTour from '@/components/AdminMenuTour';
import { 
  Users, 
  BookOpen, 
  ClipboardCheck,
  BarChart3,
  Brain,
  GraduationCap, 
  Bell,
  Home,
  Ticket,
  Receipt,
  Shield,
  GripVertical,
  CircleHelp,
  X
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultMenuItems = [
    { 
      icon: Bell, 
      label: 'Dashboard', 
      path: '/admin',
      description: 'Overview & notifications'
    },
    { 
      icon: Users, 
      label: 'Users', 
      path: '/admin/users',
      description: 'Manage user accounts'
    },
    { 
      icon: BookOpen, 
      label: 'Courses', 
      path: '/admin/courses',
      description: 'Add, edit, and delete courses'
    },
    {
      icon: ClipboardCheck,
      label: 'Assessments',
      path: '/admin/assessments',
      description: 'Build program assessments'
    },
    {
      icon: BarChart3,
      label: 'Progress',
      path: '/admin/progress',
      description: 'Student scores and answers'
    },
    { 
      icon: Brain, 
      label: 'Career Test', 
      path: '/admin/career-test',
      description: 'Add, edit, and delete career tests'
    },
    { 
      icon: GraduationCap, 
      label: 'Enrollments', 
      path: '/admin/enrollments',
      description: 'Track student progress'
    },
    {
      icon: Receipt,
      label: 'Sales',
      path: '/admin/sales',
      description: 'Program sales and revenue'
    },
    { 
      icon: Home, 
      label: 'Homepage', 
      path: '/admin/homepage',
      description: 'Manage homepage content'
    },
    { 
      icon: Ticket, 
      label: 'Coupons', 
      path: '/admin/coupons',
      description: 'Manage discount codes'
    },
  ];

const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState(defaultMenuItems);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const draggedPathRef = useRef<string | null>(null);
  const didDragRef = useRef(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    const savedOrder = readAdminMenuOrder(user?.id, localStorage);
    setMenuItems(applySavedMenuOrder(defaultMenuItems, savedOrder));
  }, [user?.id]);

  useEffect(() => {
    if (!isOpen || hasSeenAdminMenuTour(user?.id, localStorage)) {
      return;
    }
    setIsTourOpen(true);
  }, [isOpen, user?.id]);

  const closeTour = () => {
    markAdminMenuTourSeen(user?.id, localStorage);
    setIsTourOpen(false);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <div className="flex h-full min-h-0 w-64 flex-col overflow-hidden border-r border-gray-200 bg-white shadow-xl">
      {/* Sidebar Header */}
      <div className="shrink-0 border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
              <p className="text-xs text-gray-500">KIKI Learning Hub</p>
            </div>
          </div>
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsTourOpen(true)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1"
              aria-label="Show the menu guide"
            >
              <CircleHelp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Navigation Menu */}
      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isDragging = draggedPath === item.path;
          const isDropTarget = dropTargetPath === item.path && draggedPath !== item.path;
          
          return (
            <Button
              key={item.path}
              data-admin-tour={item.path}
              variant="ghost"
              draggable
              className={`w-full justify-start h-auto cursor-grab p-4 rounded-lg transition-all duration-200 active:cursor-grabbing ${
                isActive 
                  ? 'bg-red-50 text-red-700 border border-red-200 shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              } ${isDragging ? 'opacity-50' : ''} ${isDropTarget ? 'ring-2 ring-red-300' : ''}`}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                handleNavigation(item.path);
              }}
              onDragStart={(event) => {
                didDragRef.current = true;
                draggedPathRef.current = item.path;
                setDraggedPath(item.path);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.path);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (dropTargetPath !== item.path) {
                  setDropTargetPath(item.path);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourcePath = event.dataTransfer.getData('text/plain') || draggedPathRef.current;
                if (!sourcePath) {
                  return;
                }
                const nextItems = reorderMenuItems(menuItems, sourcePath, item.path);
                setMenuItems(nextItems);
                writeAdminMenuOrder(user?.id, nextItems.map((menuItem) => menuItem.path), localStorage);
                setDraggedPath(null);
                setDropTargetPath(null);
              }}
              onDragEnd={() => {
                draggedPathRef.current = null;
                setDraggedPath(null);
                setDropTargetPath(null);
                window.setTimeout(() => {
                  didDragRef.current = false;
                }, 0);
              }}
            >
              <GripVertical className={`mr-2 shrink-0 ${isActive ? 'text-red-400' : 'text-gray-400'}`} />
              <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? 'text-red-600' : 'text-gray-500'}`} />
              <div className="text-left flex-1 min-w-0">
                <div className={`font-medium truncate ${isActive ? 'text-red-700' : 'text-gray-900'}`}>
                  {item.label}
                </div>
                <div className={`text-xs truncate ${isActive ? 'text-red-600' : 'text-gray-500'}`}>
                  {item.description}
                </div>
              </div>
            </Button>
          );
        })}
      </nav>
      {isTourOpen && (
        <AdminMenuTour steps={tourStepsForMenu(menuItems)} onClose={closeTour} />
      )}
    </div>
  );
};

export default AdminSidebar;
