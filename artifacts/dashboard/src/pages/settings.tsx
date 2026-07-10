import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  Body,
  Cell,
  Header,
  HeaderCell,
  Row,
} from "@/components/ui/table-layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, Shield, Clock, Hash, Save, Users, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("roles");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('role_id, roles!inner(name)').eq('id', user.id).single();
        if (data && data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          setUserRole(data.roles[0].name || null);
        } else if (data && data.roles && typeof data.roles === 'object' && !Array.isArray(data.roles)) {
          setUserRole((data.roles as any).name || null);
        }
      }
    }
    checkRole();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-sidebar">System Settings</h2>
        <p className="text-muted-foreground">Configure roles, shifts, and application preferences.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap gap-1 h-auto">
          <TabsTrigger value="account" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground px-2 sm:px-3">
            <UserCheck className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">My Account</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground px-2 sm:px-3">
            <Shield className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Roles & Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground px-2 sm:px-3">
            <Clock className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Shift Master</span>
          </TabsTrigger>
          <TabsTrigger value="employee-id" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground px-2 sm:px-3">
            <Hash className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Employee ID</span>
          </TabsTrigger>
          {userRole === 'admin' && (
            <TabsTrigger value="users" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground px-2 sm:px-3">
              <Users className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="m-0">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="roles" className="m-0">
          <RolesSettings />
        </TabsContent>

        <TabsContent value="shifts" className="m-0">
          <ShiftMaster />
        </TabsContent>

        <TabsContent value="employee-id" className="m-0">
          <EmployeeIdSettings userRole={userRole} />
        </TabsContent>

        {userRole === 'admin' && (
          <TabsContent value="users" className="m-0">
            <UserManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AccountSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    async function fetchUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase
          .from('users')
          .select('id, name, email, phone')
          .eq('id', authUser.id)
          .single();
        if (data) {
          setUser(data);
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
          });
        }
      }
    }
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>My Account</CardTitle>
        <CardDescription>Update your profile information and phone number for OTP login.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input 
              type="email"
              value={formData.email} 
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <Input 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="+91-9876543210"
            />
            <p className="text-xs text-muted-foreground">Used for OTP login. Include country code.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RolesSettings() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      setLoading(true);
      const { data } = await supabase.from('roles').select('*').order('name');
      if (data) setRoles(data);
      setLoading(false);
    }
    fetchRoles();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>View available system roles and their descriptions.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[500px]">
          <Header>
            <Row>
              <HeaderCell>Role Name</HeaderCell>
              <HeaderCell>Description</HeaderCell>
              <HeaderCell className="text-right">Status</HeaderCell>
            </Row>
          </Header>
          <Body>
            {loading ? (
              <Row><Cell colSpan={3} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
            ) : roles.length === 0 ? (
              <Row>
                <Cell colSpan={3} className="h-32 text-center text-muted-foreground">
                  No roles found.
                </Cell>
              </Row>
            ) : (
              roles.map(role => (
                <Row key={role.id}>
                  <Cell className="font-medium text-sidebar capitalize">{role.name}</Cell>
                  <Cell className="text-muted-foreground">{role.description || 'No description provided'}</Cell>
                  <Cell className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                      Active
                    </span>
                  </Cell>
                </Row>
              ))
            )}
          </Body>
        </Table>
      </CardContent>
    </Card>
  );
}

function ShiftMaster() {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);

  const fetchShifts = async () => {
    setLoading(true);
    const { data } = await supabase.from('shift_master').select('*').order('start_time');
    if (data) setShifts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    try {
      const { error } = await supabase.from('shift_master').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Shift deleted" });
      fetchShifts();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle>Shift Master</CardTitle>
          <CardDescription>Manage work shifts and grace periods.</CardDescription>
        </div>
        <Button onClick={() => { setEditingShift(null); setDialogOpen(true); }} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Shift
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[500px]">
          <Header>
            <Row>
              <HeaderCell>Shift Name</HeaderCell>
              <HeaderCell>Start Time</HeaderCell>
              <HeaderCell>End Time</HeaderCell>
              <HeaderCell>Grace Time (mins)</HeaderCell>
              <HeaderCell className="text-right">Actions</HeaderCell>
            </Row>
          </Header>
          <Body>
            {loading ? (
              <Row><Cell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
            ) : shifts.length === 0 ? (
              <Row>
                <Cell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No shifts defined.
                </Cell>
              </Row>
            ) : (
              shifts.map(shift => (
                <Row key={shift.id}>
                  <Cell className="font-medium">{shift.name}</Cell>
                  <Cell>{shift.start_time}</Cell>
                  <Cell>{shift.end_time}</Cell>
                  <Cell>{shift.grace_minutes} mins</Cell>
                  <Cell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingShift(shift); setDialogOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(shift.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Cell>
                </Row>
              ))
            )}
          </Body>
        </Table>

        <ShiftDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
          shift={editingShift} 
          onSuccess={fetchShifts} 
        />
      </CardContent>
    </Card>
  );
}

function ShiftDialog({ open, onOpenChange, shift, onSuccess }: any) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!shift;
  
  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    grace_minutes: '15'
  });

  useEffect(() => {
    if (open) {
      if (shift) {
        setFormData({
          name: shift.name || '',
          start_time: shift.start_time || '09:00',
          end_time: shift.end_time || '18:00',
          grace_minutes: shift.grace_minutes?.toString() || '15',
        });
      } else {
        setFormData({ name: '', start_time: '09:00', end_time: '18:00', grace_minutes: '15' });
      }
    }
  }, [open, shift]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      grace_minutes: parseInt(formData.grace_minutes) || 0
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('shift_master').update(payload).eq('id', shift.id);
        if (error) throw error;
        toast({ title: 'Shift updated' });
      } else {
        const { error } = await supabase.from('shift_master').insert([payload]);
        if (error) throw error;
        toast({ title: 'Shift created' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Shift Name</label>
            <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time</label>
              <Input type="time" required value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Time</label>
              <Input type="time" required value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Grace Period (minutes)</label>
            <Input type="number" required min="0" value={formData.grace_minutes} onChange={e => setFormData({...formData, grace_minutes: e.target.value})} />
          </div>
          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*, role:roles(name, description)')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setUsers(data || []);
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('id, name');
    if (data) setRoles(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.account_status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('users').update({ account_status: newStatus }).eq('id', user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `User ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
      fetchUsers();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage admin and recruiter accounts.</CardDescription>
        </div>
        <Button onClick={() => { setEditingUser(null); setDialogOpen(true); }} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[500px]">
          <Header>
            <Row>
              <HeaderCell>Name</HeaderCell>
              <HeaderCell>Email / Phone</HeaderCell>
              <HeaderCell>Role</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell className="text-right">Actions</HeaderCell>
            </Row>
          </Header>
          <Body>
            {loading ? (
              <Row><Cell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
            ) : users.length === 0 ? (
              <Row><Cell colSpan={5} className="h-32 text-center text-muted-foreground">No users found.</Cell></Row>
            ) : (
              users.map((u: any) => (
                <Row key={u.id}>
                  <Cell className="font-medium">{u.name || '—'}</Cell>
                  <Cell className="text-muted-foreground text-sm">{u.email || u.phone || '—'}</Cell>
                  <Cell><span className="capitalize">{u.role?.name || 'Unassigned'}</span></Cell>
                  <Cell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.account_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      u.account_status === 'inactive' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {u.account_status || 'pending'}
                    </span>
                  </Cell>
                  <Cell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setDialogOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(u)}>
                      {u.account_status === 'active' ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-emerald-500" />}
                    </Button>
                  </Cell>
                </Row>
              ))
            )}
          </Body>
        </Table>

        <UserDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
          user={editingUser} 
          roles={roles}
          onSuccess={fetchUsers} 
        />
      </CardContent>
    </Card>
  );
}

function UserDialog({ open, onOpenChange, user, roles, onSuccess }: any) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role_id: 'none',
    account_status: 'active',
  });

  useEffect(() => {
    if (open) {
      if (user) {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          role_id: user.role_id || 'none',
          account_status: user.account_status || 'active',
        });
      } else {
        setFormData({ name: '', email: '', phone: '', role_id: 'none', account_status: 'active' });
      }
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      role_id: formData.role_id === 'none' ? null : formData.role_id,
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('users').update(payload).eq('id', user.id);
        if (error) throw error;
        toast({ title: 'User updated' });
      } else {
        // Create via Supabase Auth first, then insert into users table
        if (!payload.email) {
          toast({ title: 'Email required', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: payload.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: payload.name },
        });
        if (authError) throw authError;

        if (authData.user) {
          const { error: userError } = await supabase.from('users').insert({
            id: authData.user.id,
            email: payload.email,
            name: payload.name,
            phone: payload.phone || null,
            role_id: payload.role_id,
            account_status: payload.account_status,
          });
          if (userError) throw userError;
        }

        toast({ title: 'User created', description: `Temporary password: ${tempPassword}` });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required={!isEdit} disabled={isEdit} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={formData.role_id} onValueChange={(val) => setFormData({...formData, role_id: val})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Status</label>
            <Select value={formData.account_status} onValueChange={(val) => setFormData({...formData, account_status: val})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeIdSettings({ userRole }: { userRole: string | null }) {
  if (userRole === 'admin') {
    return <AdminEmployeeIdSettings />;
  }
  return <RecruiterEmployeeIdSettings />;
}

function RecruiterEmployeeIdSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [prefix, setPrefix] = useState('EMP');
  const [sequence, setSequence] = useState('1000');

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setInitialLoading(false); return; }
      setUserId(user.id);

      const { data, error } = await supabase
        .from('employee_id_settings')
        .select('prefix, next_sequence')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading employee ID settings:', error);
      } else if (data) {
        setPrefix(data.prefix);
        setSequence(String(data.next_sequence));
      }
      setInitialLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('employee_id_settings')
        .upsert(
          { user_id: userId, prefix: prefix.toUpperCase(), next_sequence: parseInt(sequence) || 1000 },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      toast({ title: "Settings saved successfully" });
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Employee ID Format</CardTitle>
        <CardDescription>Configure how auto-generated employee IDs are formatted for employees you recruit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix</label>
              <Input
                value={prefix}
                onChange={e => setPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. JL"
              />
              <p className="text-xs text-muted-foreground">Letters that appear before the number.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Sequence Number</label>
              <Input
                type="number"
                value={sequence}
                onChange={e => setSequence(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Suggested number for your next employee.</p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between border">
            <span className="text-sm font-medium">Preview:</span>
            <span className="text-lg font-bold font-mono text-sidebar tracking-wider">
              {prefix}{sequence}
            </span>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Format Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminEmployeeIdSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  const fetchRecruiters = async () => {
    setLoading(true);
    const { data: recruiterUsers } = await supabase
      .from('users')
      .select('id, name, email, roles!inner(name)')
      .eq('roles.name', 'recruiter');

    const { data: settingsRows } = await supabase
      .from('employee_id_settings')
      .select('user_id, prefix, next_sequence');

    const settingsByUser = new Map((settingsRows || []).map((s: any) => [s.user_id, s]));

    const merged = (recruiterUsers || []).map((r: any) => {
      const s = settingsByUser.get(r.id);
      return {
        user_id: r.id,
        name: r.name || r.email,
        prefix: s?.prefix || 'EMP',
        next_sequence: s?.next_sequence ?? 1000,
      };
    });

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { fetchRecruiters(); }, []);

  const updateRow = (userId: string, field: 'prefix' | 'next_sequence', value: string) => {
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, [field]: value } : r));
  };

  const saveRow = async (row: any) => {
    setSavingId(row.user_id);
    try {
      const { error } = await supabase
        .from('employee_id_settings')
        .upsert(
          { user_id: row.user_id, prefix: String(row.prefix).toUpperCase(), next_sequence: parseInt(row.next_sequence) || 1000 },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      toast({ title: `Saved for ${row.name}` });
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee ID Format — Per Recruiter</CardTitle>
        <CardDescription>Each recruiter has their own prefix and sequence. Edit any recruiter's counter here.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[500px]">
          <Header>
            <Row>
              <HeaderCell>Recruiter</HeaderCell>
              <HeaderCell>Prefix</HeaderCell>
              <HeaderCell>Next Sequence</HeaderCell>
              <HeaderCell>Preview</HeaderCell>
              <HeaderCell className="text-right">Actions</HeaderCell>
            </Row>
          </Header>
          <Body>
            {loading ? (
              <Row><Cell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
            ) : rows.length === 0 ? (
              <Row><Cell colSpan={5} className="h-32 text-center text-muted-foreground">No recruiters found.</Cell></Row>
            ) : (
              rows.map(row => (
                <Row key={row.user_id}>
                  <Cell className="font-medium">{row.name}</Cell>
                  <Cell>
                    <Input className="w-24" value={row.prefix} onChange={e => updateRow(row.user_id, 'prefix', e.target.value.toUpperCase())} />
                  </Cell>
                  <Cell>
                    <Input className="w-28" type="number" value={row.next_sequence} onChange={e => updateRow(row.user_id, 'next_sequence', e.target.value)} />
                  </Cell>
                  <Cell className="font-mono">{row.prefix}{row.next_sequence}</Cell>
                  <Cell className="text-right">
                    <Button size="sm" disabled={savingId === row.user_id} onClick={() => saveRow(row)}>
                      {savingId === row.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </Cell>
                </Row>
              ))
            )}
          </Body>
        </Table>
      </CardContent>
    </Card>
  );
}
