import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizePasswordChange,
  saveAccountPassword,
  saveProfileDetails,
  type AccountPasswordClient,
  type NormalizedProfileDetails,
  type ProfileDetailsClient,
} from '@/lib/profileDetails';

interface ProfileDetailsEditorProps {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  onCancel: () => void;
  onSaved: (details: NormalizedProfileDetails) => void;
}

const ProfileDetailsEditor: React.FC<ProfileDetailsEditorProps> = ({
  userId,
  fullName,
  email,
  phone,
  onCancel,
  onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(fullName);
  const [nextEmail, setNextEmail] = useState(email);
  const [nextPhone, setNextPhone] = useState(phone);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const passwordChange = normalizePasswordChange(password, confirmPassword);
      if ('error' in passwordChange) {
        throw new Error(passwordChange.error);
      }
      const isCurrentUser = user?.id === userId;
      const saved = await saveProfileDetails(supabase as unknown as ProfileDetailsClient, userId, {
        fullName: name,
        email: nextEmail,
        phone: nextPhone,
      }, isCurrentUser);
      if (passwordChange.password) {
        try {
          await saveAccountPassword(supabase as unknown as AccountPasswordClient, userId, passwordChange.password, isCurrentUser);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Could not change the password.';
          throw new Error(`Name, email, and phone were saved. ${reason}`);
        }
      }
      toast({
        title: 'Details saved',
        description: passwordChange.password
          ? 'Name, email, phone, and password are updated.'
          : saved.syncedSignIn
            ? 'Name, email, and phone are updated.'
            : 'The profile is updated. Apply the latest database migration so the sign-in email changes too.',
      });
      onSaved(saved);
    } catch (error) {
      toast({
        title: 'Could not save details',
        description: error instanceof Error ? error.message : 'Could not save these details.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <Label htmlFor={`profile-name-${userId}`}>Name</Label>
        <Input
          id={`profile-name-${userId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={120}
        />
      </div>
      <div>
        <Label htmlFor={`profile-email-${userId}`}>Email</Label>
        <Input
          id={`profile-email-${userId}`}
          type="email"
          value={nextEmail}
          onChange={(event) => setNextEmail(event.target.value)}
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor={`profile-phone-${userId}`}>Phone</Label>
        <Input
          id={`profile-phone-${userId}`}
          value={nextPhone}
          onChange={(event) => setNextPhone(event.target.value)}
          autoComplete="tel"
          maxLength={20}
        />
      </div>
      <div>
        <Label htmlFor={`profile-password-${userId}`}>New password</Label>
        <Input
          id={`profile-password-${userId}`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={72}
        />
        <p className="mt-1 text-xs text-gray-500">Leave blank to keep the current password.</p>
      </div>
      <div>
        <Label htmlFor={`profile-confirm-password-${userId}`}>Confirm password</Label>
        <Input
          id={`profile-confirm-password-${userId}`}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={72}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save details'}
        </Button>
      </div>
    </form>
  );
};

export default ProfileDetailsEditor;
