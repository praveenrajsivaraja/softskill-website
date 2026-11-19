
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineUserIds } from '@/contexts/OnlinePresence';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { isNewSiteUser } from '@/lib/newUser';
import { importUsers } from '@/lib/adminSheetImport';
import { describeSheetImport } from '@/lib/spreadsheet';
import { userSheetHeaders, userSheetSample } from '@/lib/sheetTemplates';
import AdminSheetMenu from '@/components/AdminSheetMenu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import ProfileDetailsEditor from '@/components/ProfileDetailsEditor';
import type { NormalizedProfileDetails } from '@/lib/profileDetails';
import AdminSearchableTab from '@/components/AdminSearchableTab';
import DownloadReportButton from '@/components/DownloadReportButton';
import { filterRecordsBySearch } from '@/lib/adminSearch';
import { userReportSheet } from '@/lib/adminScreenReports';
import {
  enrollmentExpiresAt,
  summarizeUserLearning,
  type EnrollmentRecord,
  type UserLearningSummary,
} from '@/lib/userLearningSummary';

type UserRole = 'student' | 'instructor' | 'admin';

const USER_ROLES: UserRole[] = ['student', 'instructor', 'admin'];

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  lastSignInAt: string | null;
  learning: UserLearningSummary;
  enrollments: EnrollmentRecord[];
}

const formatDate = (value: string | null) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const readCourse = (
  course: { title: string | null; duration: string | null } | { title: string | null; duration: string | null }[] | null,
) => (Array.isArray(course) ? course[0] ?? null : course);

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [canReadLastLogin, setCanReadLastLogin] = useState(true);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'student' as UserRole });
  const { toast } = useToast();
  const { user: signedInUser } = useAuth();
  const onlineUserIds = useOnlineUserIds();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setIsEditingUser(false);
  }, [selectedUserId]);

  const applySavedUserDetails = (userId: string, details: NormalizedProfileDetails) => {
    setUsers((previousUsers) => previousUsers.map((user) => (
      user.id === userId
        ? { ...user, full_name: details.fullName, email: details.email, phone: details.phone }
        : user
    )));
    setIsEditingUser(false);
  };

  const filteredUsers = useMemo(
    () => filterRecordsBySearch(users, userSearch, (user) => [
      user.full_name,
      user.email,
      user.phone,
      user.role,
      user.learning.recentCourseTitle,
      ...user.learning.currentTitles,
    ]),
    [users, userSearch],
  );

  const userReport = useMemo(() => [userReportSheet(filteredUsers.map((user) => ({
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    isActive: user.is_active !== false,
    currentCourses: user.learning.currentTitles.join(', '),
    recentCourse: user.learning.recentCourseTitle ?? '',
    enrolledAt: formatDate(user.learning.recentEnrolledAt),
    expiresAt: user.learning.recentAccess === 'expired'
      ? `Expired ${formatDate(user.learning.recentExpiresAt)}`
      : formatDate(user.learning.recentExpiresAt),
    lastLogin: canReadLastLogin ? (user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Never') : 'Unavailable',
    joined: formatDate(user.created_at),
  })))], [filteredUsers, canReadLastLogin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [profileResult, enrollmentResult, signInResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('id, student_id, status, progress, enrolled_at, completed_at, courses(title, duration)'),
        supabase.rpc('admin_user_sign_ins'),
      ]);

      if (profileResult.error) {
        console.error(JSON.stringify({
          event: 'admin_user_list_failed',
          code: profileResult.error.code,
          message: profileResult.error.message,
        }));
        toast({
          title: "Error",
          description: "Failed to fetch users.",
          variant: "destructive",
        });
        return;
      }

      if (enrollmentResult.error) {
        console.error(JSON.stringify({
          event: 'admin_user_enrollment_lookup_failed',
          code: enrollmentResult.error.code,
          message: enrollmentResult.error.message,
        }));
        toast({
          title: "Enrollments",
          description: "User accounts loaded, but their courses could not be loaded.",
          variant: "destructive",
        });
      }

      const signInsByUserId = new Map<string, string | null>();
      const signInColumnAvailable = (profileResult.data ?? []).some((profile) =>
        Object.prototype.hasOwnProperty.call(profile, 'last_sign_in_at'),
      );
      if (signInResult.error) {
        console.error(JSON.stringify({
          event: 'admin_user_sign_in_lookup_failed',
          code: signInResult.error.code,
          message: signInResult.error.message,
        }));
      } else {
        for (const signIn of signInResult.data ?? []) {
          signInsByUserId.set(signIn.user_id, signIn.last_sign_in_at);
        }
      }
      setCanReadLastLogin(!signInResult.error || signInColumnAvailable);

      const enrollmentsByStudent = new Map<string, EnrollmentRecord[]>();
      for (const enrollment of enrollmentResult.data ?? []) {
        if (!enrollment.student_id) {
          continue;
        }
        const course = readCourse(enrollment.courses);
        const record: EnrollmentRecord = {
          id: enrollment.id,
          courseTitle: course?.title ?? 'Untitled course',
          duration: course?.duration ?? null,
          status: enrollment.status,
          progress: enrollment.progress,
          enrolledAt: enrollment.enrolled_at,
          completedAt: enrollment.completed_at,
        };
        const existing = enrollmentsByStudent.get(enrollment.student_id) ?? [];
        existing.push(record);
        enrollmentsByStudent.set(enrollment.student_id, existing);
      }

      const observedAt = new Date();
      setUsers((profileResult.data ?? []).map((profile) => {
        const enrollments = enrollmentsByStudent.get(profile.id) ?? [];
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          is_active: profile.is_active !== false,
          created_at: profile.created_at ?? new Date(0).toISOString(),
          avatar_url: profile.avatar_url,
          lastSignInAt: signInsByUserId.get(profile.id) ?? profile.last_sign_in_at ?? null,
          learning: summarizeUserLearning(enrollments, observedAt),
          enrollments,
        };
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshUsers = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
    toast({
      title: "Success",
      description: "User list refreshed successfully.",
    });
  };

  const updateUserRole = async (userId: string, nextRole: UserRole) => {
    const selectedUser = users.find((user) => user.id === userId);
    if (!selectedUser || selectedUser.role === nextRole) {
      return;
    }

    setUpdatingRoleUserId(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user role:', error);
        toast({
          title: "Error",
          description: "Failed to update the user role.",
          variant: "destructive",
        });
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.id === userId ? { ...user, role: nextRole } : user
        )
      );

      toast({
        title: "Role updated",
        description: `${selectedUser.email} is now ${nextRole}.`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update the user role.",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const updateAccountStatus = async (userId: string, isActive: boolean) => {
    if (signedInUser?.id === userId && !isActive) {
      toast({
        title: 'Account status',
        description: 'You cannot deactivate the account you are signed in with.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingStatusUserId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error(JSON.stringify({
          event: 'account_status_update_failed',
          code: error.code,
          message: error.message,
        }));
        toast({
          title: 'Account status',
          description: error.message.includes('is_active')
            ? 'Run the account status SQL in Supabase before activating or deactivating users.'
            : 'Could not update this account.',
          variant: 'destructive',
        });
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((user) => user.id === userId ? { ...user, is_active: isActive } : user)
      );
      toast({
        title: isActive ? 'Account activated' : 'Account deactivated',
        description: isActive
          ? 'This user can sign in again.'
          : 'This user can no longer sign in.',
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'account_status_update_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      toast({
        title: 'Account status',
        description: 'Could not update this account.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatusUserId(null);
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    setDeletingUserId(userId);
    
    try {
      // First, try to delete from auth.users using the admin API
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('Error deleting user from auth:', authError);
        
        // If auth deletion fails, still try to delete from profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          console.error('Error deleting user profile:', profileError);
          toast({
            title: "Error",
            description: "Failed to delete user completely. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Partial Success",
          description: "User profile deleted, but authentication record may remain. User won't be able to access the system.",
        });
      } else {
        // Auth deletion successful, profile should be deleted automatically via CASCADE
        toast({
          title: "Success",
          description: `User ${userEmail} has been deleted successfully.`,
        });
      }

      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== userId));
      
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const openCreateUser = () => {
    setNewUser({ email: '', full_name: '', password: '', role: 'student' });
    setIsCreateOpen(true);
  };

  const createSingleUser = async () => {
    setIsCreatingUser(true);
    try {
      const result = await importUsers([{
        email: newUser.email,
        full_name: newUser.full_name,
        password: newUser.password,
        role: newUser.role,
        is_active: 'true',
      }], signedInUser?.id ?? null);
      const saved = result.created + result.updated > 0;
      toast({
        title: result.created > 0 ? 'User created' : saved ? 'User updated' : 'User was not created',
        description: describeSheetImport(result),
        variant: saved ? 'default' : 'destructive',
      });
      if (saved) {
        setIsCreateOpen(false);
        fetchUsers();
      }
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-3">
          <div>
            <CardTitle>User Management</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Download the sample, add one row per person, and save it as CSV. A matching email updates that user.
              {canReadLastLogin ? '' : ' Last login appears after the user activity SQL is applied in Supabase.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminSheetMenu
              label="Create user"
              singleLabel="Create single user"
              multipleLabel="Upload multiple users"
              templateFilename="users-template.csv"
              templateHeaders={userSheetHeaders}
              templateSample={userSheetSample}
              onCreateOne={openCreateUser}
              importRows={(rows) => importUsers(rows, signedInUser?.id ?? null)}
              onComplete={fetchUsers}
            />
            <DownloadReportButton filename="users-report.xls" sheets={userReport} disabled={filteredUsers.length === 0} />
            <Button
            onClick={refreshUsers}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AdminSearchableTab
          searchTerm={userSearch}
          onSearch={setUserSearch}
          placeholder="Search by name, email, role, or course..."
        >
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Learning</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-gray-600 text-sm">
                            {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            {onlineUserIds.has(user.id) && (
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-green-500"
                                role="img"
                                aria-label="Online"
                                title="Online"
                              />
                            )}
                            <span>{user.full_name || 'N/A'}</span>
                          </span>
                          {isNewSiteUser(user.created_at) && <Badge className="bg-kiki-purple-100 text-kiki-purple-800">New</Badge>}
                        </div>
                        {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role ?? 'student'}
                      onValueChange={(value) => updateUserRole(user.id, value as UserRole)}
                      disabled={updatingRoleUserId === user.id}
                    >
                      <SelectTrigger className="w-36" aria-label={`Role for ${user.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updatingStatusUserId === user.id || signedInUser?.id === user.id}
                      onClick={() => void updateAccountStatus(user.id, user.is_active === false)}
                    >
                      {updatingStatusUserId === user.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : user.is_active === false ? 'Activate' : 'Deactivate'}
                    </Button>
                  </TableCell>
                  <TableCell className="min-w-[220px] text-sm">
                    <p>
                      <span className="text-gray-500">Currently enrolled: </span>
                      {user.learning.currentTitles.length > 0
                        ? user.learning.currentTitles.slice(0, 3).join(', ')
                        : 'None'}
                      {user.learning.currentTitles.length > 3 && ` +${user.learning.currentTitles.length - 3} more`}
                    </p>
                    {user.learning.recentCourseTitle ? (
                      <>
                        <p className="mt-1">
                          <span className="text-gray-500">Recent course: </span>
                          {user.learning.recentCourseTitle}
                        </p>
                        <p>
                          <span className="text-gray-500">Enrolled: </span>
                          {formatDate(user.learning.recentEnrolledAt)}
                        </p>
                        {user.learning.recentAccess === 'expired' ? (
                          <p className="text-red-600">Expired {formatDate(user.learning.recentExpiresAt)}</p>
                        ) : (
                          <p>
                            <span className="text-gray-500">Expires: </span>
                            {user.learning.recentExpiresAt ? formatDate(user.learning.recentExpiresAt) : 'No end date'}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-gray-500">No enrollments yet</p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canReadLastLogin ? (user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Never') : 'Unavailable'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        Details
                      </Button>
                    {user.role !== 'admin' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deletingUserId === user.id}
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the user "{user.email}"? 
                              This action cannot be undone and will remove all their data, including authentication records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteUser(user.id, user.email)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No users found. {users.length === 0 && 'Try refreshing to load users.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </AdminSearchableTab>
      </CardContent>
    </Card>
    <Dialog open={selectedUserId !== null} onOpenChange={(isOpen) => { if (!isOpen) { setSelectedUserId(null); setIsEditingUser(false); } }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {(() => {
          const selectedUser = users.find((user) => user.id === selectedUserId);
          if (!selectedUser) {
            return null;
          }
          const history = [...selectedUser.enrollments].sort((left, right) => {
            const leftTime = left.enrolledAt ? new Date(left.enrolledAt).getTime() : 0;
            const rightTime = right.enrolledAt ? new Date(right.enrolledAt).getTime() : 0;
            return rightTime - leftTime;
          });
          return (
            <>
              <DialogHeader>
                <DialogTitle>{selectedUser.full_name || selectedUser.email}</DialogTitle>
                <DialogDescription>
                  {selectedUser.email}
                  {selectedUser.phone ? ` · ${selectedUser.phone}` : ''}
                  {` · ${selectedUser.role ?? 'student'}`}
                  {` · joined ${formatDate(selectedUser.created_at)}`}
                  {` · last login ${canReadLastLogin ? (selectedUser.lastSignInAt ? formatDateTime(selectedUser.lastSignInAt) : 'never') : 'unavailable'}`}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Account details</p>
                  {!isEditingUser && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingUser(true)}>
                      Edit details
                    </Button>
                  )}
                </div>
                {isEditingUser ? (
                  <ProfileDetailsEditor
                    key={selectedUser.id}
                    userId={selectedUser.id}
                    fullName={selectedUser.full_name ?? ''}
                    email={signedInUser?.id === selectedUser.id ? (signedInUser.email || selectedUser.email) : selectedUser.email}
                    phone={selectedUser.phone ?? ''}
                    onCancel={() => setIsEditingUser(false)}
                    onSaved={(details) => applySavedUserDetails(selectedUser.id, details)}
                  />
                ) : (
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><span className="font-medium">Name:</span> {selectedUser.full_name || 'No name yet'}</p>
                    <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                    <p><span className="font-medium">Phone:</span> {selectedUser.phone || 'No phone number yet'}</p>
                    <p><span className="font-medium">Password:</span> Change it with Edit details</p>
                  </div>
                )}
              </div>
              <div className="max-h-[40vh] space-y-3 overflow-y-auto">
                <p className="text-sm font-medium">Enrollments</p>
                {history.length === 0 && <p className="text-sm text-gray-500">This person has no enrollments yet.</p>}
                {history.map((enrollment) => {
                  const expiresAt = enrollmentExpiresAt(enrollment.enrolledAt, enrollment.duration);
                  return (
                    <div key={enrollment.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{enrollment.courseTitle}</p>
                        <Badge variant="secondary">{enrollment.status ?? 'unknown'}</Badge>
                      </div>
                      <p className="mt-1 text-gray-600">Enrolled {formatDate(enrollment.enrolledAt)}</p>
                      <p className="text-gray-600">
                        Expires {expiresAt ? formatDate(expiresAt) : 'no end date'}
                        {enrollment.duration ? ` · ${enrollment.duration}` : ''}
                      </p>
                      <p className="text-gray-600">
                        Progress {enrollment.progress ?? 0}%
                        {enrollment.completedAt ? ` · completed ${formatDate(enrollment.completedAt)}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create single user</DialogTitle>
          <DialogDescription>
            The person can sign in with this email and password. The password is not shown again after the account is created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="new-user-name">Name</Label>
            <Input id="new-user-name" value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="new-user-password">Password</Label>
            <Input id="new-user-password" type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={() => void createSingleUser()} disabled={isCreatingUser}>
            {isCreatingUser ? 'Creating…' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default UserManagement;
