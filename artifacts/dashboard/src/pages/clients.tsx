import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Search, Plus, Loader2, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching clients", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => 
    search === "" || 
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.contact_person.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Client deleted successfully" });
      fetchClients();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-sidebar">Clients</h2>
          <p className="text-muted-foreground">Manage client organizations and contacts.</p>
        </div>
        <Button onClick={() => { setEditingClient(null); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Header>
              <Row>
                <HeaderCell>Client Name</HeaderCell>
                <HeaderCell>Contact Person</HeaderCell>
                <HeaderCell>Email / Phone</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell className="text-right">Actions</HeaderCell>
              </Row>
            </Header>
            <Body>
              {loading ? (
                <Row>
                  <Cell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </Cell>
                </Row>
              ) : filteredClients.length === 0 ? (
                <Row>
                  <Cell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No clients found.
                  </Cell>
                </Row>
              ) : (
                filteredClients.map((client) => (
                  <Row key={client.id}>
                    <Cell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-bold text-primary">{client.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="font-semibold text-sidebar">{client.name}</div>
                      </div>
                    </Cell>
                    <Cell>{client.contact_person}</Cell>
                    <Cell>
                      <div className="text-sm">{client.email}</div>
                      <div className="text-xs text-muted-foreground">{client.phone}</div>
                    </Cell>
                    <Cell>
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className={
                        client.status === 'active' ? 'bg-success hover:bg-success/90' : ''
                      }>
                        {client.status}
                      </Badge>
                    </Cell>
                    <Cell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingClient(client); setIsDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Cell>
                  </Row>
                ))
              )}
            </Body>
          </Table>
        </CardContent>
      </Card>

      <ClientDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        client={editingClient}
        onSuccess={fetchClients}
      />
    </div>
  );
}

function ClientDialog({ open, onOpenChange, client, onSuccess }: any) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!client;
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    if (open) {
      if (client) {
        setFormData({
          name: client.name || '',
          contact_person: client.contact_person || '',
          email: client.email || '',
          phone: client.phone || '',
          address: client.address || '',
          status: client.status || 'active',
        });
      } else {
        setFormData({
          name: '',
          contact_person: '',
          email: '',
          phone: '',
          address: '',
          status: 'active',
        });
      }
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        const { error } = await supabase.from('clients').update(formData).eq('id', client.id);
        if (error) throw error;
        toast({ title: 'Client updated successfully' });
      } else {
        const { error } = await supabase.from('clients').insert([formData]);
        if (error) throw error;
        toast({ title: 'Client created successfully' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Operation failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-112.5">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Company Name</label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Person</label>
              <Input 
                value={formData.contact_person} 
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Address</label>
            <Input 
              value={formData.address} 
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          
          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
