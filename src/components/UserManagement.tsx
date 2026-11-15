
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import AdminSearchableTab from '@/components/AdminSearchableTab';

type UserRole = 'student' | 'instructor' | 'admin';

const USER_ROLES: UserRole[] = ['student', 'instructor', 'admin'];

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: signedInUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setFilteredUsers(users);
  }, [users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "Error",
          description: "Failed to fetch users.",
          variant: "destructive",
        });
        return;
      }

      setUsers(data || []);
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

  const handleUserSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    const filtered = users.filter(user =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>User Management</CardTitle>
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
      </CardHeader>
      <CardContent>
        <AdminSearchableTab 
          onSearch={handleUserSearch}
          placeholder="Search by name, email, or role..."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Avatar</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.full_name || 'N/A'}</TableCell>
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
                  <TableCell>
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.full_name || 'User'} 
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-600 text-sm">
                          {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No users found. {users.length === 0 && 'Try refreshing to load users.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminSearchableTab>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
