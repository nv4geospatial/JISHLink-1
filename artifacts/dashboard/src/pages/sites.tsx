import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useGenerateQrCode } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Search, Plus, Loader2, Edit, Trash2, QrCode, MapPin, Crosshair, Map as MapIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

// Leaflet imports (lazy-loaded in map component)
type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
};

export default function SitesPage() {
  const { toast } = useToast();
  const [sites, setSites] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const { role, user } = useAuth();
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentQrSite, setCurrentQrSite] = useState<any>(null);

  const fetchSitesAndClients = async () => {
    try {
      setLoading(true);
      const [sitesRes, clientsRes, recruitersRes] = await Promise.all([
        supabase.from("sites").select("*, client:clients(name)").order("name"),
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("users").select("id, name, email, roles!inner(name)").eq("roles.name", "recruiter")
      ]);
      
      if (sitesRes.error) throw sitesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      
      setSites(sitesRes.data || []);
      setClients(clientsRes.data || []);
      setRecruiters(recruitersRes.data || []);
    } catch (error: any) {
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSitesAndClients();
  }, []);

  const filteredSites = sites.filter(site => 
    search === "" || 
    site.name.toLowerCase().includes(search.toLowerCase()) ||
    site.client?.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this site?")) return;
    
    try {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Site deleted successfully" });
      fetchSitesAndClients();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  const handleShowQr = (site: any) => {
    setCurrentQrSite(site);
    setQrDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-sidebar">Operating Sites</h2>
          <p className="text-muted-foreground">Manage work locations, geofences, and QR codes.</p>
        </div>
        <Button onClick={() => { setEditingSite(null); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search sites..." 
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
                <HeaderCell>Site Info</HeaderCell>
                <HeaderCell>Location</HeaderCell>
                <HeaderCell>Geofence</HeaderCell>
                <HeaderCell>Supervisor</HeaderCell>
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
              ) : filteredSites.length === 0 ? (
                <Row>
                  <Cell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No sites found.
                  </Cell>
                </Row>
              ) : (
                filteredSites.map((site) => (
                  <Row key={site.id}>
                    <Cell>
                      <div className="font-semibold text-sidebar flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {site.name}
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">{site.client?.name}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm max-w-50 truncate" title={site.address}>{site.address}</div>
                      <div className="text-xs text-muted-foreground">{site.latitude}, {site.longitude}</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{site.geofence_radius_meters}m</div>
                    </Cell>
                    <Cell>
                      <div className="text-sm">{site.supervisor_name || 'Unassigned'}</div>
                    </Cell>
                    <Cell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleShowQr(site)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        QR
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingSite(site); setIsDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(site.id)}>
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

      <SiteDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        site={editingSite}
        clients={clients}
        recruiters={recruiters}
        role={role}
        currentUserId={user?.id}
        onSuccess={fetchSitesAndClients}
      />

      <QrDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        site={currentQrSite}
        onSuccess={fetchSitesAndClients}
      />
    </div>
  );
}

function SiteDialog({ open, onOpenChange, site, clients, recruiters, onSuccess, role, currentUserId }: any) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const isEdit = !!site;
  
  const [formData, setFormData] = useState({
    name: '',
    client_id: 'none',
    assigned_recruiter_id: 'none',
    address: '',
    latitude: '',
    longitude: '',
    geofence_radius_meters: 100,
    supervisor_name: '',
  });

  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  // Address search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      if (site) {
        setFormData({
          name: site.name || '',
          client_id: site.client_id || 'none',
          assigned_recruiter_id: site.assigned_recruiter_id || 'none',
          address: site.address || '',
          latitude: site.latitude || '',
          longitude: site.longitude || '',
          geofence_radius_meters: site.geofence_radius_meters || 100,
          supervisor_name: site.supervisor_name || '',
        });
        setSearchQuery(site.address || '');
      } else {
        setFormData({
          name: '',
          client_id: 'none',
          assigned_recruiter_id: role === 'recruiter' ? currentUserId : 'none',
          address: '',
          latitude: '',
          longitude: '',
          geofence_radius_meters: 100,
          supervisor_name: '',
        });
        setSearchQuery("");
      }
      setSearchResults([]);
      setShowDropdown(false);
      setLocationAccuracy(null);
    }
  }, [open, site]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    setSearching(true);
    setShowDropdown(true);
    
    // Cancel previous request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    searchAbortRef.current = new AbortController();

    try {
      // Add countrycodes=in for India-biased results, accept-language for English
      // Use structured query for better results: q=query + countrycodes=in
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&countrycodes=in&accept-language=en&extratags=1&namedetails=1`,
        {
          signal: searchAbortRef.current.signal,
          headers: { "User-Agent": "JISHLink/1.0" },
        }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data as NominatimResult[]);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== (site?.address || "")) {
        searchAddress(searchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchAddress, site]);

  const selectResult = (result: NominatimResult) => {
    setSearchQuery(result.display_name);
    setFormData(prev => ({
      ...prev,
      address: result.display_name,
      latitude: result.lat,
      longitude: result.lon,
    }));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        
        setFormData(prev => ({ 
          ...prev, 
          latitude: lat.toString(), 
          longitude: lon.toString() 
        }));
        setLocationAccuracy(accuracy);
        
        // Reverse geocode to get address
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
          headers: { "User-Agent": "JISHLink/1.0" },
        })
          .then(r => r.json())
          .then(data => {
            if (data.display_name) {
              setSearchQuery(data.display_name);
              setFormData(prev => ({ ...prev, address: data.display_name }));
            }
          })
          .catch(() => {});
        
        const accuracyMsg = accuracy ? ` (±${Math.round(accuracy)}m accuracy)` : '';
        toast({ 
          title: "Location captured", 
          description: `${lat.toFixed(5)}, ${lon.toFixed(5)}${accuracyMsg}` 
        });
        
        if (accuracy && accuracy > 200) {
          toast({ 
            title: "Low accuracy warning", 
            description: `Accuracy is ±${Math.round(accuracy)}m. Please verify on map for precise positioning.`,
            variant: "destructive"
          });
        }
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Please allow location access.",
          2: "Location unavailable. Please check that GPS is turned on.",
          3: "Location request timed out.",
        };
        toast({ 
          title: "Could not get location", 
          description: messages[err.code] || "Please ensure location services are enabled.", 
          variant: "destructive" 
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleMapSelect = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
    }));
    setLocationAccuracy(null); // Manually verified — no accuracy concern
    // Reverse geocode
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": "JISHLink/1.0" },
    })
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          setSearchQuery(data.display_name);
          setFormData(prev => ({ ...prev, address: data.display_name }));
        }
      })
      .catch(() => {});
    setMapOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      client_id: formData.client_id === 'none' ? null : formData.client_id,
      assigned_recruiter_id: role === 'recruiter'
        ? currentUserId
        : (formData.assigned_recruiter_id === 'none' ? null : formData.assigned_recruiter_id),
      latitude: parseFloat(formData.latitude as string) || 0,
      longitude: parseFloat(formData.longitude as string) || 0,
      geofence_radius_meters: parseInt(formData.geofence_radius_meters as any) || 100,
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('sites').update(payload).eq('id', site.id);
        if (error) throw error;
        toast({ title: 'Site updated successfully' });
      } else {
        const { error } = await supabase.from('sites').insert([payload]);
        if (error) throw error;
        toast({ title: 'Site created successfully' });
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-137.5">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Site' : 'Add New Site'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Site Name</label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={formData.client_id} onValueChange={(val) => setFormData({...formData, client_id: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Assigned Recruiter</label>
                {role === 'admin' ? (
                  <>
                    <Select value={formData.assigned_recruiter_id} onValueChange={(val) => setFormData({...formData, assigned_recruiter_id: val})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {recruiters.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name || r.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">The recruiter who manages employees at this site.</p>
                  </>
                ) : (
                  <div className="text-sm px-3 py-2 rounded-md border bg-muted/50 text-muted-foreground">
                    This site will be assigned to you automatically.
                  </div>
                )}
              </div>
              
              {/* Address Search with Nominatim */}
              <div className="space-y-2 col-span-2" ref={searchRef}>
                <label className="text-sm font-medium">Address</label>
                <div className="relative">
                  <Input 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="Type address to search..."
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  
                  {/* Search Results Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.place_id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-0"
                          onClick={() => selectResult(result)}
                        >
                          <div className="font-medium truncate">{result.display_name}</div>
                          <div className="text-xs text-muted-foreground">Lat: {parseFloat(result.lat).toFixed(5)}, Lon: {parseFloat(result.lon).toFixed(5)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {showDropdown && !searching && searchResults.length === 0 && searchQuery.trim().length >= 3 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                      No results found. Try a different address or use the map picker below.
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={useCurrentLocation}
                    className="text-xs"
                  >
                    <Crosshair className="mr-1 h-3 w-3" />
                    Use My Current Location
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setMapOpen(true)}
                    className="text-xs"
                  >
                    <MapIcon className="mr-1 h-3 w-3" />
                    Pick on Map
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Latitude</label>
                  {locationAccuracy !== null && (
                    <span className={`text-xs ${locationAccuracy > 200 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      ±{Math.round(locationAccuracy)}m
                    </span>
                  )}
                </div>
                <Input 
                  type="number" step="any"
                  value={formData.latitude} 
                  onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Longitude</label>
                  {formData.latitude && formData.longitude && (
                    <button
                      type="button"
                      onClick={() => setMapOpen(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Verify on Map
                    </button>
                  )}
                </div>
                <Input 
                  type="number" step="any"
                  value={formData.longitude} 
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  required
                />
              </div>
              {locationAccuracy !== null && locationAccuracy > 200 && (
                <div className="col-span-2 bg-destructive/10 border border-destructive/30 rounded-md p-2.5 text-xs text-destructive">
                  <strong>⚠️ Low accuracy detected:</strong> Your location accuracy is ±{Math.round(locationAccuracy)}m. 
                  The employee may not be able to check in. Please click <strong>"Verify on Map"</strong> to adjust the pin to the exact location.
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Geofence Radius (m)</label>
                <Input 
                  type="number"
                  value={formData.geofence_radius_meters} 
                  onChange={(e) => setFormData({...formData, geofence_radius_meters: e.target.value as any})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supervisor Name</label>
                <Input 
                  value={formData.supervisor_name} 
                  onChange={(e) => setFormData({...formData, supervisor_name: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4 space-x-2">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Site'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Picker Dialog */}
      <MapPickerDialog 
        open={mapOpen} 
        onOpenChange={setMapOpen} 
        onSelect={handleMapSelect}
        initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
        initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
      />
    </>
  );
}

// Lazy-loaded Leaflet map picker with built-in address search
function MapPickerDialog({ open, onOpenChange, onSelect, initialLat, initialLng }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selectedPos, setSelectedPos] = useState<{lat: number; lng: number} | null>(null);
  
  // Map search state
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSearching, setMapSearching] = useState(false);

  // Default to Bangalore if no initial position
  const defaultLat = initialLat ?? 12.9716;
  const defaultLng = initialLng ?? 77.5946;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadLeaflet = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      
      if (cancelled || !mapRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 16);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
      markerRef.current = marker;
      setSelectedPos({ lat: defaultLat, lng: defaultLng });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedPos({ lat: pos.lat, lng: pos.lng });
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setSelectedPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      setLeafletLoaded(true);
    };

    loadLeaflet();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
      setLeafletLoaded(false);
      setMapSearchQuery("");
    };
  }, [open, defaultLat, defaultLng]);

  // Search inside map dialog
  const searchOnMap = async () => {
    if (!mapSearchQuery.trim() || mapSearchQuery.trim().length < 3) return;
    
    setMapSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&limit=5&addressdetails=1&countrycodes=in&accept-language=en&extratags=1&namedetails=1`,
        { headers: { "User-Agent": "JISHLink/1.0" } }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json() as NominatimResult[];
      
      if (data.length > 0 && mapInstanceRef.current && markerRef.current) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        
        // Pan map to result and move marker
        mapInstanceRef.current.setView([lat, lng], 18); // Zoom to street level (18)
        markerRef.current.setLatLng([lat, lng]);
        setSelectedPos({ lat, lng });
      }
    } catch {
      // Silently fail or show toast
    } finally {
      setMapSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-175 max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick Location on Map</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Search bar inside map dialog */}
          <div className="flex gap-2">
            <Input
              placeholder="Search address, road, area, city..."
              value={mapSearchQuery}
              onChange={(e) => setMapSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOnMap()}
              className="flex-1"
            />
            <Button 
              onClick={searchOnMap} 
              disabled={mapSearching || mapSearchQuery.trim().length < 3}
              type="button"
            >
              {mapSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Search</span>
            </Button>
          </div>
          
          <div className="relative">
            <div 
              ref={mapRef} 
              className="w-full h-112.5 rounded-lg border border-border bg-muted"
            />
            {!leafletLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          
          {selectedPos && (
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded flex items-center justify-between">
              <span>📍 {selectedPos.lat.toFixed(6)}, {selectedPos.lng.toFixed(6)}</span>
              <span className="text-xs">Drag pin or click map to adjust</span>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedPos && onSelect(selectedPos.lat, selectedPos.lng)}
              disabled={!selectedPos}
            >
              Confirm Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({ open, onOpenChange, site, onSuccess }: any) {
  const { toast } = useToast();
  const generateMutation = useGenerateQrCode();
  
  const generateQr = () => {
    if (!site?.id) return;
    
    generateMutation.mutate({ siteId: site.id }, {
      onSuccess: (data) => {
        toast({ title: "QR Code regenerated" });
        onSuccess(); // Refresh to get new URL
      },
      onError: (err: any) => {
        toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
      }
    });
  };

  if (!site) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-100">
        <DialogHeader>
          <DialogTitle>QR Code for {site.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6 space-y-6">
          {site.qr_code_image_url ? (
            <div className="p-4 bg-white rounded-xl shadow-sm border border-border">
              <img src={site.qr_code_image_url} alt="Site QR Code" className="w-64 h-64 object-contain" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-muted/50 rounded-xl flex items-center justify-center text-muted-foreground border-2 border-dashed border-border">
              No QR Code Generated
            </div>
          )}
          
          <div className="text-center text-sm text-muted-foreground px-4">
            Employees scan this code to check in and out. The geofence radius is {site.geofence_radius_meters}m.
          </div>
          
          <div className="flex gap-4 w-full">
            <Button 
              className="flex-1" 
              variant="outline" 
              onClick={generateQr}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {site.qr_code_image_url ? 'Regenerate QR' : 'Generate QR'}
            </Button>
            {site.qr_code_image_url && (
              <Button 
                className="flex-1"
                onClick={() => {
                  // Fetch the image and trigger download
                  fetch(site.qr_code_image_url)
                    .then(response => response.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `JISHLink-QR-${site.name.replace(/\s+/g, '-')}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    })
                    .catch(() => {
                      // Fallback: open in new tab if download fails
                      window.open(site.qr_code_image_url, '_blank');
                    });
                }}
              >
                Print / Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
