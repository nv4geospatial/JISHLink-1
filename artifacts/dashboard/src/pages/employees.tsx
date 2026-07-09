import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Search, Plus, Loader2, Edit, Trash2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

// Status badge color mapping
const statusBadgeStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200",
  inactive: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200",
  on_leave: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
  terminated: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
  absconding: "bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
  terminated: "Terminated",
  absconding: "Absconding",
};

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  
  // Clients and Sites for dropdowns
  const [clients, setClients] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let query = supabase.from("employees").select("*, client:clients(name), site:sites(name), shift:shift_master(name)");
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching employees", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    const [clientsRes, sitesRes, shiftsRes, recruitersRes] = await Promise.all([
      supabase.from("clients").select("id, name"),
      supabase.from("sites").select("id, name"),
      supabase.from("shift_master").select("id, name, start_time, end_time"),
      supabase.from("users").select("id, name, email"),
    ]);
    
    setClients(clientsRes.data || []);
    setSites(sitesRes.data || []);
    setShifts(shiftsRes.data || []);
    setRecruiters(recruitersRes.data || []);
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const filteredEmployees = employees.filter((emp) =>
    search === "" ||
    emp.name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
    emp.mobile?.includes(search)
  );

  // ==================== EXPORT TO EXCEL ====================
  const handleExport = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("employees")
        .select("*, client:clients(name), site:sites(name), shift:shift_master(name)");

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      const exportData = (data || []).map((emp: any) => ({
        "Employee Code": emp.employee_code,
        "Full Name": emp.name,
        "Mobile": emp.mobile,
        "Email": emp.email || "",
        "Address": emp.address || "",
        "Educational Qualification": emp.educational_qualification || "",
        "Blood Group": emp.blood_group || "",
        "Nominee Name": emp.nominee_name || "",
        "Nominee Relationship": emp.nominee_relationship || "",
        "Nominee Contact": emp.nominee_contact_number || "",
        "Aadhaar": emp.aadhaar || "",
        "PAN": emp.pan || "",
        "Voter ID": emp.voter_id || "",
        "Driving License": emp.driving_license || "",
        "Passport": emp.passport_number || "",
        "Date of Joining": emp.date_of_joining || "",
        "Date of Leaving": emp.date_of_leaving || "",
        "Client": emp.client?.name || "",
        "Site": emp.site?.name || "",
        "Shift": emp.shift?.name || "",
        "Designation": emp.designation || "",
        "Department": emp.department || "",
        "Employment Type": emp.employment_type || "",
        "Supervisor": emp.supervisor_name || "",
        "Status": emp.status,
        "UAN": emp.uan_number || "",
        "PF Number": emp.pf_number || "",
        "ESI Number": emp.esi_number || "",
        "Basic Salary": emp.basic_salary || "",
        "Salary Type": emp.salary_type || "",
        "Bank Name": emp.bank_name || "",
        "Account Number": emp.bank_account_number || "",
        "IFSC Code": emp.ifsc_code || "",
        "Bank Branch": emp.bank_branch || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, `employees_export_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast({ title: "Export successful", description: `${exportData.length} employees exported.` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ==================== IMPORT FROM EXCEL ====================
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        toast({ title: "Import failed", description: "No data found in file.", variant: "destructive" });
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const row of jsonData) {
        try {
          const r = row as any;
          const payload = {
            employee_code: r["Employee Code"] || r["employee_code"] || "",
            name: r["Full Name"] || r["name"] || "",
            mobile: String(r["Mobile"] || r["mobile"] || ""),
            email: r["Email"] || r["email"] || null,
            address: r["Address"] || r["address"] || null,
            educational_qualification: r["Educational Qualification"] || r["educational_qualification"] || null,
            blood_group: r["Blood Group"] || r["blood_group"] || null,
            nominee_name: r["Nominee Name"] || r["nominee_name"] || null,
            nominee_relationship: r["Nominee Relationship"] || r["nominee_relationship"] || null,
            nominee_contact_number: r["Nominee Contact"] || r["nominee_contact_number"] || null,
            aadhaar: r["Aadhaar"] || r["aadhaar"] || null,
            pan: r["PAN"] || r["pan"] || null,
            voter_id: r["Voter ID"] || r["voter_id"] || null,
            driving_license: r["Driving License"] || r["driving_license"] || null,
            passport_number: r["Passport"] || r["passport_number"] || null,
            date_of_joining: r["Date of Joining"] || r["date_of_joining"] || null,
            date_of_leaving: r["Date of Leaving"] || r["date_of_leaving"] || null,
            designation: r["Designation"] || r["designation"] || null,
            department: r["Department"] || r["department"] || null,
            employment_type: (r["Employment Type"] || r["employment_type"] || "permanent").toLowerCase(),
            supervisor_name: r["Supervisor"] || r["supervisor_name"] || null,
            status: (r["Status"] || r["status"] || "active").toLowerCase(),
            uan_number: r["UAN"] || r["uan_number"] || null,
            pf_number: r["PF Number"] || r["pf_number"] || null,
            esi_number: r["ESI Number"] || r["esi_number"] || null,
            basic_salary: r["Basic Salary"] || r["basic_salary"] || null,
            salary_type: (r["Salary Type"] || r["salary_type"] || "monthly").toLowerCase(),
            bank_name: r["Bank Name"] || r["bank_name"] || null,
            bank_account_number: r["Account Number"] || r["bank_account_number"] || null,
            ifsc_code: r["IFSC Code"] || r["ifsc_code"] || null,
            bank_branch: r["Bank Branch"] || r["bank_branch"] || null,
          };

          if (!payload.employee_code || !payload.name || !payload.mobile) {
            failCount++;
            errors.push(`Row ${successCount + failCount}: Missing required fields`);
            continue;
          }

          const { error } = await supabase.from("employees").insert([payload]);
          if (error) {
            failCount++;
            errors.push(`Row ${successCount + failCount}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          failCount++;
          errors.push(`Row ${successCount + failCount}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: `Import complete: ${successCount} imported, ${failCount} failed`,
          description: failCount > 0 ? errors.slice(0, 3).join("; ") : "All records imported successfully.",
          variant: failCount > 0 ? "destructive" : "default",
        });
        fetchEmployees();
      } else {
        toast({ title: "Import failed", description: errors.slice(0, 3).join("; "), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    
    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Employee deleted successfully" });
      fetchEmployees();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-sidebar">Employees</h2>
          <p className="text-muted-foreground">Manage workforce, assignments, and statuses.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => { setEditingEmployee(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name, ID, or mobile..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="absconding">Absconding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <Header>
              <Row>
                <HeaderCell>Employee</HeaderCell>
                <HeaderCell>Contact</HeaderCell>
                <HeaderCell>Assignment</HeaderCell>
                <HeaderCell>Shift</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell className="text-right">Actions</HeaderCell>
              </Row>
            </Header>
            <Body>
              {loading ? (
                <Row>
                  <Cell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </Cell>
                </Row>
              ) : filteredEmployees.length === 0 ? (
                <Row>
                  <Cell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No employees found matching your criteria.
                  </Cell>
                </Row>
              ) : (
                filteredEmployees.map((emp) => (
                  <Row key={emp.id}>
                    <Cell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-sidebar/10 flex items-center justify-center shrink-0">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="font-semibold text-xs text-sidebar">{emp.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">{emp.employee_code}</div>
                        </div>
                      </div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{emp.mobile}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm font-medium">{emp.site?.name || 'Unassigned'}</div>
                      <div className="text-xs text-muted-foreground">{emp.client?.name}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{emp.shift?.name || 'N/A'}</div>
                    </Cell>
                    <Cell>
                      <Badge variant="outline" className={statusBadgeStyles[emp.status] || statusBadgeStyles.inactive}>
                        {statusLabels[emp.status] || emp.status}
                      </Badge>
                    </Cell>
                    <Cell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingEmployee(emp); setIsDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(emp.id)}>
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

      <EmployeeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        employee={editingEmployee}
        clients={clients}
        sites={sites}
        shifts={shifts}
        recruiters={recruiters}
        onSuccess={fetchEmployees}
      />
    </div>
  );
}

// Simple internal component for the dialog
function EmployeeDialog({ open, onOpenChange, employee, clients, sites, shifts, recruiters, onSuccess }: any) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!employee;
  
  const [activeTab, setActiveTab] = useState("basic");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  const handleRecruiterChange = async (recruiterId: string) => {
    if (isEdit || codeManuallyEdited || recruiterId === 'none') return;
    const { data, error } = await supabase
      .from('employee_id_settings')
      .select('prefix, next_sequence')
      .eq('user_id', recruiterId)
      .maybeSingle();

    updateField("employee_code", !error && data ? `${data.prefix}${data.next_sequence}` : 'EMP1000');
  };

  const [formData, setFormData] = useState<Record<string, any>>({
    employee_code: '',
    name: '',
    mobile: '',
    email: '',
    address: '',
    educational_qualification: '',
    blood_group: '',
    nominee_name: '',
    nominee_relationship: '',
    nominee_contact_number: '',
    aadhaar: '',
    pan: '',
    voter_id: '',
    driving_license: '',
    passport_number: '',
    date_of_joining: '',
    date_of_leaving: '',
    client_id: 'none',
    site_id: 'none',
    shift_id: 'none',
    recruiter_id: 'none',
    designation: '',
    department: '',
    employment_type: 'permanent',
    supervisor_name: '',
    status: 'active',
    uan_number: '',
    pf_number: '',
    esi_number: '',
    basic_salary: '',
    salary_type: 'monthly',
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
    bank_branch: '',
  });

  useEffect(() => {
    if (open) {
      if (employee) {
        setFormData({
          employee_code: employee.employee_code || '',
          name: employee.name || '',
          mobile: employee.mobile || '',
          email: employee.email || '',
          address: employee.address || '',
          educational_qualification: employee.educational_qualification || '',
          blood_group: employee.blood_group || '',
          nominee_name: employee.nominee_name || '',
          nominee_relationship: employee.nominee_relationship || '',
          nominee_contact_number: employee.nominee_contact_number || '',
          aadhaar: employee.aadhaar || '',
          pan: employee.pan || '',
          voter_id: employee.voter_id || '',
          driving_license: employee.driving_license || '',
          passport_number: employee.passport_number || '',
          date_of_joining: employee.date_of_joining || '',
          date_of_leaving: employee.date_of_leaving || '',
          client_id: employee.client_id || 'none',
          site_id: employee.site_id || 'none',
          shift_id: employee.shift_id || 'none',
          recruiter_id: employee.recruiter_id || 'none',
          designation: employee.designation || '',
          department: employee.department || '',
          employment_type: employee.employment_type || 'permanent',
          supervisor_name: employee.supervisor_name || '',
          status: employee.status || 'active',
          uan_number: employee.uan_number || '',
          pf_number: employee.pf_number || '',
          esi_number: employee.esi_number || '',
          basic_salary: employee.basic_salary || '',
          salary_type: employee.salary_type || 'monthly',
          bank_name: employee.bank_name || '',
          bank_account_number: employee.bank_account_number || '',
          ifsc_code: employee.ifsc_code || '',
          bank_branch: employee.bank_branch || '',
        });
      } else {
        setCodeManuallyEdited(false);
        setFormData({
          employee_code: '',
          name: '',
          mobile: '',
          email: '',
          address: '',
          educational_qualification: '',
          blood_group: '',
          nominee_name: '',
          nominee_relationship: '',
          nominee_contact_number: '',
          aadhaar: '',
          pan: '',
          voter_id: '',
          driving_license: '',
          passport_number: '',
          date_of_joining: '',
          date_of_leaving: '',
          client_id: 'none',
          site_id: 'none',
          shift_id: 'none',
          recruiter_id: 'none',
          designation: '',
          department: '',
          employment_type: 'permanent',
          supervisor_name: '',
          status: 'active',
          uan_number: '',
          pf_number: '',
          esi_number: '',
          basic_salary: '',
          salary_type: 'monthly',
          bank_name: '',
          bank_account_number: '',
          ifsc_code: '',
          bank_branch: '',
        });
      }
      setActiveTab("basic");
    }
  }, [open, employee]);

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      client_id: formData.client_id === 'none' ? null : formData.client_id,
      site_id: formData.site_id === 'none' ? null : formData.site_id,
      shift_id: formData.shift_id === 'none' ? null : formData.shift_id,
      recruiter_id: formData.recruiter_id === 'none' ? null : formData.recruiter_id,
      basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null,
      // Fix date fields: empty string → null, otherwise keep as-is (HTML date input sends YYYY-MM-DD)
      date_of_joining: formData.date_of_joining || null,
      date_of_leaving: formData.date_of_leaving || null,
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('employees').update(payload).eq('id', employee.id);
        if (error) throw error;
        toast({ title: 'Employee updated successfully' });
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;

        if (payload.recruiter_id) {
          const { error: seqError } = await supabase.rpc('increment_employee_sequence', {
            p_user_id: payload.recruiter_id,
          });
          if (seqError) console.error('Could not advance employee ID sequence:', seqError.message);
        }

        toast({ title: 'Employee created successfully' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Operation failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full";
  const labelClass = "text-sm font-medium";
  const fieldClass = "space-y-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-175 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="govt">Govt IDs</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
            </TabsList>

            {/* BASIC DETAILS TAB */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Recruiter</label>
                  <Select
                    value={formData.recruiter_id}
                    onValueChange={(val) => { updateField("recruiter_id", val); handleRecruiterChange(val); }}
                    disabled={isEdit}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {recruiters.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name || r.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!isEdit && <p className="text-xs text-muted-foreground">Selecting a recruiter suggests their next Employee Code.</p>}
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Employee Code *</label>
                  <Input
                    className={inputClass}
                    value={formData.employee_code}
                    onChange={(e) => { updateField("employee_code", e.target.value); setCodeManuallyEdited(true); }}
                    required
                    disabled={isEdit}
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Full Name *</label>
                  <Input className={inputClass} value={formData.name} onChange={(e) => updateField("name", e.target.value)} required />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Mobile Number *</label>
                  <Input className={inputClass} value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)} required />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Email</label>
                  <Input className={inputClass} type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Address</label>
                  <Input className={inputClass} value={formData.address} onChange={(e) => updateField("address", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Educational Qualification</label>
                  <Input className={inputClass} value={formData.educational_qualification} onChange={(e) => updateField("educational_qualification", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Blood Group</label>
                  <Select value={formData.blood_group} onValueChange={(val) => updateField("blood_group", val)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Nominee Name</label>
                  <Input className={inputClass} value={formData.nominee_name} onChange={(e) => updateField("nominee_name", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Nominee Relationship</label>
                  <Input className={inputClass} value={formData.nominee_relationship} onChange={(e) => updateField("nominee_relationship", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Nominee Contact Number</label>
                  <Input className={inputClass} value={formData.nominee_contact_number} onChange={(e) => updateField("nominee_contact_number", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* GOVERNMENT IDs TAB */}
            <TabsContent value="govt" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Aadhaar Number</label>
                  <Input className={inputClass} value={formData.aadhaar} onChange={(e) => updateField("aadhaar", e.target.value)} maxLength={12} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>PAN Number</label>
                  <Input className={inputClass} value={formData.pan} onChange={(e) => updateField("pan", e.target.value)} maxLength={10} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Voter ID (Optional)</label>
                  <Input className={inputClass} value={formData.voter_id} onChange={(e) => updateField("voter_id", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Driving License (Optional)</label>
                  <Input className={inputClass} value={formData.driving_license} onChange={(e) => updateField("driving_license", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Passport Number (Optional)</label>
                  <Input className={inputClass} value={formData.passport_number} onChange={(e) => updateField("passport_number", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* EMPLOYMENT DETAILS TAB */}
            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Date of Joining</label>
                  <Input className={inputClass} type="date" value={formData.date_of_joining} onChange={(e) => updateField("date_of_joining", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Date of Leaving/Relieving</label>
                  <Input className={inputClass} type="date" value={formData.date_of_leaving} onChange={(e) => updateField("date_of_leaving", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Client</label>
                  <Select value={formData.client_id} onValueChange={(val) => updateField("client_id", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Site</label>
                  <Select value={formData.site_id} onValueChange={(val) => updateField("site_id", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Shift</label>
                  <Select value={formData.shift_id} onValueChange={(val) => updateField("shift_id", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {shifts.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className={fieldClass}>
                  <label className={labelClass}>Designation/Role</label>
                  <Input className={inputClass} value={formData.designation} onChange={(e) => updateField("designation", e.target.value)} placeholder="e.g. Security Guard" />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Department</label>
                  <Input className={inputClass} value={formData.department} onChange={(e) => updateField("department", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Employment Type</label>
                  <Select value={formData.employment_type} onValueChange={(val) => updateField("employment_type", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="daily_wage">Daily Wage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Supervisor Name (Client-side)</label>
                  <Input className={inputClass} value={formData.supervisor_name} onChange={(e) => updateField("supervisor_name", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Status</label>
                  <Select value={formData.status} onValueChange={(val) => updateField("status", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="absconding">Absconding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* STATUTORY & COMPLIANCE TAB */}
            <TabsContent value="compliance" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>UAN Number (PF)</label>
                  <Input className={inputClass} value={formData.uan_number} onChange={(e) => updateField("uan_number", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>PF Number</label>
                  <Input className={inputClass} value={formData.pf_number} onChange={(e) => updateField("pf_number", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>ESI Number</label>
                  <Input className={inputClass} value={formData.esi_number} onChange={(e) => updateField("esi_number", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* SALARY & BANKING TAB */}
            <TabsContent value="banking" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Basic Salary/Wage</label>
                  <Input className={inputClass} type="number" value={formData.basic_salary} onChange={(e) => updateField("basic_salary", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Salary Type</label>
                  <Select value={formData.salary_type} onValueChange={(val) => updateField("salary_type", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="per_day">Per Day</SelectItem>
                      <SelectItem value="per_hour">Per Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Bank Name</label>
                  <Input className={inputClass} value={formData.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Bank Account Number</label>
                  <Input className={inputClass} value={formData.bank_account_number} onChange={(e) => updateField("bank_account_number", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>IFSC Code</label>
                  <Input className={inputClass} value={formData.ifsc_code} onChange={(e) => updateField("ifsc_code", e.target.value)} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Bank Branch</label>
                  <Input className={inputClass} value={formData.bank_branch} onChange={(e) => updateField("bank_branch", e.target.value)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Employee'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
