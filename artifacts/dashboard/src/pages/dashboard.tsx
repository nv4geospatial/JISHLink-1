import {
  useGetDashboardStats,
  useGetAttendanceTrend,
  useGetRecentCheckins,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useGetAttendanceTrend({});
 const { data: checkins, isLoading: checkinsLoading } = useGetRecentCheckins(
  { limit: 10 },
  {
    query: {
      queryKey: ["recent-checkins", { limit: 10 }], // <-- add this
      refetchInterval: 15000,
    },
  }
);

  const statCards = [
    { title: "Total Employees", value: stats?.total_employees || 0, icon: Users, color: "text-sidebar", bg: "bg-sidebar/10" },
    { title: "Present Today", value: stats?.present_today || 0, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { title: "Absent Today", value: stats?.absent_today || 0, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: "Late Arrivals", value: stats?.late_today || 0, icon: Clock, color: "text-accent", bg: "bg-accent/10" },
    { title: "Total Sites", value: stats?.total_sites || 0, icon: MapPin, color: "text-sidebar-accent", bg: "bg-sidebar-accent/10" },
    { title: "Total Clients", value: stats?.total_clients || 0, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-sidebar">Command Center Overview</h2>
        <p className="text-muted-foreground">Monitor your workforce across all sites in real-time.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className="shadow-sm border-t-2 border-t-sidebar/20 hover:border-t-sidebar transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-7 w-16 bg-muted animate-pulse rounded-md mt-1" />
                ) : (
                  <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5 shadow-sm">
          <CardHeader>
            <CardTitle>Attendance Trend (14 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pl-0 h-87.5">
            {trendLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : trend?.data && trend.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="present" name="Present" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="late" name="Late" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="absent" name="Absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-2 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
              Live Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-87.5 pr-2">
            {checkinsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : checkins?.data && checkins.data.length > 0 ? (
              <div className="space-y-4">
                {checkins.data.map((checkin) => (
                  <div key={checkin.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                    <div className="h-10 w-10 rounded-full bg-sidebar/10 flex items-center justify-center shrink-0">
                      {checkin.photo_url ? (
                        <img src={checkin.photo_url} alt={checkin.employee_name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-sidebar" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium truncate pr-2">{checkin.employee_name}</p>
                        <Badge variant={checkin.status === 'present' ? 'default' : 'secondary'} className={
                          checkin.status === 'present' ? 'bg-success hover:bg-success/90' : 'bg-accent text-accent-foreground hover:bg-accent/90'
                        }>
                          {checkin.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{checkin.site_name}</p>
                      <p className="text-xs font-medium text-sidebar mt-1">
                        {format(new Date(checkin.check_in_time), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center py-12 text-center text-muted-foreground">
                <p>No check-ins yet today.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
