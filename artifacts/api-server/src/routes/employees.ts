import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import * as XLSX from 'xlsx';

const router = Router();

// TODO: Replace these stubs with your actual auth middleware imports
// If your auth.ts exports different names (e.g., verifyToken, isAdmin), import those instead
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Add your authentication logic here (JWT verify, session check, etc.)
  next();
  return;
};

const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // Add your admin role check here
  next();
  return;
};

// GET /api/employees — List all employees with filters
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, client_id, site_id, search } = req.query;
    
    let query = supabase
      .from('employees')
      .select('*, client:clients(name), site:sites(name), shift:shift_master(name), recruiter:users(email)');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    if (site_id) {
      query = query.eq('site_id', site_id);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,employee_code.ilike.%${search}%,mobile.ilike.%${search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error('Error fetching employees: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id — Get single employee
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('employees')
      .select('*, client:clients(name), site:sites(name), shift:shift_master(name), recruiter:users(email)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error('Error fetching employee: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees — Create new employee
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    
    const cleanPayload = {
      ...payload,
      client_id: payload.client_id === 'none' || payload.client_id === '' ? null : payload.client_id,
      site_id: payload.site_id === 'none' || payload.site_id === '' ? null : payload.site_id,
      shift_id: payload.shift_id === 'none' || payload.shift_id === '' ? null : payload.shift_id,
      recruiter_id: payload.recruiter_id === 'none' || payload.recruiter_id === '' ? null : payload.recruiter_id,
      date_of_joining: payload.date_of_joining === '' ? null : payload.date_of_joining,
      date_of_leaving: payload.date_of_leaving === '' ? null : payload.date_of_leaving,
    };

    const { data, error } = await supabase
      .from('employees')
      .insert([cleanPayload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    logger.error('Error creating employee: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id — Update employee
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    
    const cleanPayload = {
      ...payload,
      client_id: payload.client_id === 'none' || payload.client_id === '' ? null : payload.client_id,
      site_id: payload.site_id === 'none' || payload.site_id === '' ? null : payload.site_id,
      shift_id: payload.shift_id === 'none' || payload.shift_id === '' ? null : payload.shift_id,
      recruiter_id: payload.recruiter_id === 'none' || payload.recruiter_id === '' ? null : payload.recruiter_id,
      date_of_joining: payload.date_of_joining === '' ? null : payload.date_of_joining,
      date_of_leaving: payload.date_of_leaving === '' ? null : payload.date_of_leaving,
    };

    const { data, error } = await supabase
      .from('employees')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error('Error updating employee: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id — Delete employee
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('employees').delete().eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err: any) {
    logger.error('Error deleting employee: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/export/excel — Export employees to Excel
router.get('/export/excel', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    let query = supabase
      .from('employees')
      .select('*, client:clients(name), site:sites(name), shift:shift_master(name)');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const exportData = (data || []).map((emp: any) => ({
      'Employee Code': emp.employee_code,
      'Full Name': emp.name,
      'Mobile': emp.mobile,
      'Email': emp.email || '',
      'Address': emp.address || '',
      'Educational Qualification': emp.educational_qualification || '',
      'Blood Group': emp.blood_group || '',
      'Nominee Name': emp.nominee_name || '',
      'Nominee Relationship': emp.nominee_relationship || '',
      'Nominee Contact': emp.nominee_contact_number || '',
      'Aadhaar': emp.aadhaar || '',
      'PAN': emp.pan || '',
      'Voter ID': emp.voter_id || '',
      'Driving License': emp.driving_license || '',
      'Passport': emp.passport_number || '',
      'Date of Joining': emp.date_of_joining || '',
      'Date of Leaving': emp.date_of_leaving || '',
      'Client': emp.client?.name || '',
      'Site': emp.site?.name || '',
      'Shift': emp.shift?.name || '',
      'Designation': emp.designation || '',
      'Department': emp.department || '',
      'Employment Type': emp.employment_type || '',
      'Supervisor': emp.supervisor_name || '',
      'Status': emp.status,
      'UAN': emp.uan_number || '',
      'PF Number': emp.pf_number || '',
      'ESI Number': emp.esi_number || '',
      'Basic Salary': emp.basic_salary || '',
      'Salary Type': emp.salary_type || '',
      'Bank Name': emp.bank_name || '',
      'Account Number': emp.bank_account_number || '',
      'IFSC Code': emp.ifsc_code || '',
      'Bank Branch': emp.bank_branch || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
    res.send(buf);
  } catch (err: any) {
    logger.error('Error exporting employees: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/import — Import employees from Excel/CSV
router.post('/import', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { employees: importData } = req.body;
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of importData) {
      try {
        const payload = {
          employee_code: row['Employee Code'] || row['employee_code'],
          name: row['Full Name'] || row['name'],
          mobile: String(row['Mobile'] || row['mobile'] || ''),
          email: row['Email'] || row['email'] || null,
          address: row['Address'] || row['address'] || null,
          educational_qualification: row['Educational Qualification'] || row['educational_qualification'] || null,
          blood_group: row['Blood Group'] || row['blood_group'] || null,
          nominee_name: row['Nominee Name'] || row['nominee_name'] || null,
          nominee_relationship: row['Nominee Relationship'] || row['nominee_relationship'] || null,
          nominee_contact_number: row['Nominee Contact'] || row['nominee_contact_number'] || null,
          aadhaar: row['Aadhaar'] || row['aadhaar'] || null,
          pan: row['PAN'] || row['pan'] || null,
          voter_id: row['Voter ID'] || row['voter_id'] || null,
          driving_license: row['Driving License'] || row['driving_license'] || null,
          passport_number: row['Passport'] || row['passport_number'] || null,
          date_of_joining: row['Date of Joining'] || row['date_of_joining'] || null,
          date_of_leaving: row['Date of Leaving'] || row['date_of_leaving'] || null,
          designation: row['Designation'] || row['designation'] || null,
          department: row['Department'] || row['department'] || null,
          employment_type: (row['Employment Type'] || row['employment_type'] || 'permanent').toLowerCase(),
          supervisor_name: row['Supervisor'] || row['supervisor_name'] || null,
          status: (row['Status'] || row['status'] || 'active').toLowerCase(),
          uan_number: row['UAN'] || row['uan_number'] || null,
          pf_number: row['PF Number'] || row['pf_number'] || null,
          esi_number: row['ESI Number'] || row['esi_number'] || null,
          basic_salary: row['Basic Salary'] || row['basic_salary'] || null,
          salary_type: (row['Salary Type'] || row['salary_type'] || 'monthly').toLowerCase(),
          bank_name: row['Bank Name'] || row['bank_name'] || null,
          bank_account_number: row['Account Number'] || row['bank_account_number'] || null,
          ifsc_code: row['IFSC Code'] || row['ifsc_code'] || null,
          bank_branch: row['Bank Branch'] || row['bank_branch'] || null,
        };

        if (!payload.employee_code || !payload.name || !payload.mobile) {
          results.failed++;
          results.errors.push(`Row skipped: Missing required fields (code, name, or mobile)`);
          continue;
        }

        const { error } = await supabase.from('employees').insert([payload]);
        if (error) {
          results.failed++;
          results.errors.push(`Row ${payload.employee_code}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (rowErr: any) {
        results.failed++;
        results.errors.push(`Row error: ${rowErr.message}`);
      }
    }

    res.json({ success: true, results });
    return;
  } catch (err: any) {
    logger.error('Error importing employees: ' + err.message);
    res.status(500).json({ error: err.message });
    return;
  }
});

export default router;