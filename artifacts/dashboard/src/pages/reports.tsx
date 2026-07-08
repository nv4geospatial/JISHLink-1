import { useState, useEffect } from "react";
import { format, subMonths } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { 
  useGetDailyReport, 
  useGetMonthlyReport,
  useExportExcelReport,
  useExportPdfReport
} from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("daily");
  
  // Daily Filters
  const [dailyDate, setDailyDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [dailySite, setDailySite] = useState<string>("all");
  
  // Monthly Filters
  const [monthlyYear, setMonthlyYear] = useState<number>(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthlySite, setMonthlySite] = useState<string>("all");

  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("sites").select("id, name").then(({ data }) => {
      if (data) setSites(data);
    });
  }, []);

  const { data: dailyData, isLoading: dailyLoading } = useGetDailyReport(
    { 
      date: dailyDate, 
      ...(dailySite !== 'all' ? { siteId: dailySite } : {}) 
    },
    { query: { queryKey: ['dailyReport', dailyDate, dailySite], enabled: activeTab === 'daily' } }
  );

  const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReport(
    { 
      year: monthlyYear, 
      month: monthlyMonth,
      ...(monthlySite !== 'all' ? { siteId: monthlySite } : {}) 
    },
    { query: { queryKey: ['monthlyReport', monthlyYear, monthlyMonth, monthlySite], enabled: activeTab === 'monthly' } }
  );

  const excelParams: any = activeTab === 'daily' 
    ? { type: 'daily', date: dailyDate, ...(dailySite !== 'all' && { siteId: dailySite }) }
    : { type: 'monthly', year: monthlyYear, month: monthlyMonth, ...(monthlySite !== 'all' && { siteId: monthlySite }) };

  const { refetch: fetchExcel, isFetching: excelLoading } = useExportExcelReport(
    excelParams,
    { query: { queryKey: ['exportExcel', excelParams], enabled: false } }
  );

  const { refetch: fetchPdf, isFetching: pdfLoading } = useExportPdfReport(
    excelParams,
    { query: { queryKey: ['exportPdf', excelParams], enabled: false } }
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    try {
      const { data } = await fetchExcel();
      if (data) {
        downloadBlob(data as Blob, `Report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        toast({ title: "Excel export successful" });
      }
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const { data } = await fetchPdf();
      if (data) {
        downloadBlob(data as Blob, `Report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        toast({ title: "PDF export successful" });
      }
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-sidebar">Reports & Analytics</h2>
          <p className="text-muted-foreground">Generate and export attendance reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={excelLoading}>
            {excelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4 text-success" />}
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4 text-destructive" />}
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="daily" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground">Daily Report</TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground">Monthly Report</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4 m-0">
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1 w-full sm:w-auto">
                  <label className="text-xs font-medium">Date</label>
                  <Input 
                    type="date" 
                    value={dailyDate} 
                    onChange={(e) => setDailyDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1 w-full sm:w-64">
                  <label className="text-xs font-medium">Site</label>
                  <Select value={dailySite} onValueChange={setDailySite}>
                    <SelectTrigger>
                      <SelectValue />
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
              <div className="grid grid-cols-2 md:grid-cols-4 border-b divide-x divide-y md:divide-y-0">
                <div className="p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
                  <div className="text-2xl font-bold text-sidebar mt-1">{dailyData?.total || 0}</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Present</div>
                  <div className="text-2xl font-bold text-success mt-1">{dailyData?.present || 0}</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Absent</div>
                  <div className="text-2xl font-bold text-destructive mt-1">{dailyData?.absent || 0}</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Late</div>
                  <div className="text-2xl font-bold text-accent mt-1">{dailyData?.late || 0}</div>
                </div>
              </div>
              
              <Table>
                <Header>
                  <Row>
                    <HeaderCell>Employee</HeaderCell>
                    <HeaderCell>Site</HeaderCell>
                    <HeaderCell>Check In</HeaderCell>
                    <HeaderCell>Check Out</HeaderCell>
                    <HeaderCell>Status</HeaderCell>
                  </Row>
                </Header>
                <Body>
                  {dailyLoading ? (
                    <Row><Cell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
                  ) : !dailyData?.records?.length ? (
                    <Row><Cell colSpan={5} className="h-32 text-center text-muted-foreground">No data for this date.</Cell></Row>
                  ) : (
                    dailyData.records.map((r, i) => (
                      <Row key={i}>
                        <Cell>
                          <div className="font-medium">{r.employee_name}</div>
                          <div className="text-xs text-muted-foreground">{r.employee_code}</div>
                        </Cell>
                        <Cell className="text-sm">{r.site_name}</Cell>
                        <Cell className="text-sm">{r.check_in_time ? format(new Date(r.check_in_time), 'h:mm a') : '-'}</Cell>
                        <Cell className="text-sm">{r.check_out_time ? format(new Date(r.check_out_time), 'h:mm a') : '-'}</Cell>
                        <Cell>
                          <Badge variant={r.status === 'present' ? 'default' : 'secondary'} 
                                 className={r.status === 'present' ? 'bg-success hover:bg-success' : r.status === 'absent' ? 'bg-destructive text-destructive-foreground hover:bg-destructive' : r.status === 'late' ? 'bg-accent text-accent-foreground hover:bg-accent' : ''}>
                            {r.status?.toUpperCase()}
                          </Badge>
                        </Cell>
                      </Row>
                    ))
                  )}
                </Body>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 m-0">
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1 w-full sm:w-32">
                  <label className="text-xs font-medium">Year</label>
                  <Select value={monthlyYear.toString()} onValueChange={(v) => setMonthlyYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2].map(i => {
                        const y = new Date().getFullYear() - i;
                        return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-full sm:w-40">
                  <label className="text-xs font-medium">Month</label>
                  <Select value={monthlyMonth.toString()} onValueChange={(v) => setMonthlyMonth(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 12}).map((_, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>
                          {format(new Date(2000, i, 1), 'MMMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-full sm:w-64">
                  <label className="text-xs font-medium">Site</label>
                  <Select value={monthlySite} onValueChange={setMonthlySite}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites</SelectItem>
                      {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
                <span className="text-sm font-medium">Total Working Days in Month: <span className="text-sidebar ml-1">{monthlyData?.working_days || 0}</span></span>
              </div>
              <Table>
                <Header>
                  <Row>
                    <HeaderCell>Employee</HeaderCell>
                    <HeaderCell className="text-center">Present</HeaderCell>
                    <HeaderCell className="text-center">Absent</HeaderCell>
                    <HeaderCell className="text-center">Late</HeaderCell>
                    <HeaderCell className="text-right">Attendance %</HeaderCell>
                  </Row>
                </Header>
                <Body>
                  {monthlyLoading ? (
                    <Row><Cell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></Cell></Row>
                  ) : !monthlyData?.records?.length ? (
                    <Row><Cell colSpan={5} className="h-32 text-center text-muted-foreground">No data for this month.</Cell></Row>
                  ) : (
                    monthlyData.records.map((r, i) => (
                      <Row key={i}>
                        <Cell>
                          <div className="font-medium">{r.employee_name}</div>
                          <div className="text-xs text-muted-foreground">{r.employee_code}</div>
                        </Cell>
                        <Cell className="text-center font-medium text-success">{r.present_days}</Cell>
                        <Cell className="text-center font-medium text-destructive">{r.absent_days}</Cell>
                        <Cell className="text-center font-medium text-accent">{r.late_days}</Cell>
                        <Cell className="text-right">
                          <Badge variant="outline" className={`
                            ${r.attendance_percentage >= 90 ? 'text-success border-success/50' : 
                              r.attendance_percentage >= 75 ? 'text-accent border-accent/50' : 
                              'text-destructive border-destructive/50'}
                          `}>
                            {r.attendance_percentage.toFixed(1)}%
                          </Badge>
                        </Cell>
                      </Row>
                    ))
                  )}
                </Body>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
