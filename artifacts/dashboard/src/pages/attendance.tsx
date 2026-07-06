import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AttendancePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [sites, setSites] = useState<any[]>([]);

  const fetchSites = async () => {
    const { data } = await supabase.from("sites").select("id, name");
    if (data) setSites(data);
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("attendance")
        .select("*, employee:employees(name, employee_code), site:sites(name)")
        .eq("date", date);
      
      if (siteFilter !== "all") {
        query = query.eq("site_id", siteFilter);
      }
      
      const { data, error } = await query.order("check_in_time", { ascending: false });
      
      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching attendance", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [date, siteFilter]);

  const filteredRecords = records.filter(record => 
    search === "" || 
    record.employee?.name.toLowerCase().includes(search.toLowerCase()) ||
    record.employee?.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-success hover:bg-success/90';
      case 'absent': return 'bg-destructive hover:bg-destructive/90';
      case 'late': return 'bg-accent text-accent-foreground hover:bg-accent/90';
      case 'early_out': return 'bg-orange-500 hover:bg-orange-600 text-white';
      default: return 'bg-secondary';
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    try {
      return format(new Date(timeStr), "h:mm a");
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-sidebar">Attendance Log</h2>
          <p className="text-muted-foreground">View check-ins and check-outs for a specific date.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search employee..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                <HeaderCell>Site</HeaderCell>
                <HeaderCell>Date</HeaderCell>
                <HeaderCell>Check In</HeaderCell>
                <HeaderCell>Check Out</HeaderCell>
                <HeaderCell>Status</HeaderCell>
              </Row>
            </Header>
            <Body>
              {loading ? (
                <Row>
                  <Cell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </Cell>
                </Row>
              ) : filteredRecords.length === 0 ? (
                <Row>
                  <Cell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No attendance records found for this date.
                  </Cell>
                </Row>
              ) : (
                filteredRecords.map((record) => (
                  <Row key={record.id}>
                    <Cell>
                      <div className="font-medium text-sidebar">{record.employee?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{record.employee?.employee_code || '-'}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{record.site?.name || '-'}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{record.date}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm font-medium">{formatTime(record.check_in_time)}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm font-medium">{formatTime(record.check_out_time)}</div>
                    </Cell>
                    <Cell>
                      <Badge variant="secondary" className={getStatusColor(record.status)}>
                        {record.status?.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </Cell>
                  </Row>
                ))
              )}
            </Body>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
