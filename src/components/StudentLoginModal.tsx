
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StudentLoginModal: React.FC<StudentLoginModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl">
        <DialogHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-kiki-purple-500 to-kiki-blue-500 rounded-2xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Welcome to KIKI's Learning Hub
          </DialogTitle>
          <p className="text-gray-600 text-sm">
            Sign in to access your courses and continue learning
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Location Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              📍 Madurai, Tamil Nadu
            </Badge>
          </div>

          {/* Info Section */}
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-600 mb-2">
              Access your courses, track progress, and connect with instructors
            </p>
            <div className="flex justify-center gap-2">
              <Badge variant="secondary" className="text-xs">Soft Skills</Badge>
              <Badge variant="secondary" className="text-xs">Career Development</Badge>
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact: 8220879805
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentLoginModal;
