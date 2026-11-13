// lib/salary/occupations.ts
// The occupations offered in the Salary page's picker, grouped by the kinds
// of roles Preciprocal users apply for. Small and client-safe: the full list
// of ~825 BLS occupations (lib/salary/oews-data.ts) stays on the server and
// is only used for matching.
//
// Codes are 2018 SOC detailed codes as used by BLS OEWS. BLS titles are long
// ("Computer and Information Systems Managers"), so each has a shorter label
// that names the roles it covers.

export interface OccupationOption {
  code: string;
  label: string;
  group: string;
}

export const COMMON_OCCUPATIONS: OccupationOption[] = [
  // Software and IT
  { code: '15-1252', label: 'Software Developers', group: 'Software and IT' },
  { code: '15-1253', label: 'Software QA Analysts and Testers', group: 'Software and IT' },
  { code: '15-1254', label: 'Web Developers', group: 'Software and IT' },
  { code: '15-1255', label: 'Web and Digital Interface Designers (UX/UI)', group: 'Software and IT' },
  { code: '15-1211', label: 'Computer Systems Analysts', group: 'Software and IT' },
  { code: '15-1212', label: 'Information Security Analysts', group: 'Software and IT' },
  { code: '15-1221', label: 'Computer and Information Research Scientists', group: 'Software and IT' },
  { code: '15-1241', label: 'Computer Network Architects', group: 'Software and IT' },
  { code: '15-1243', label: 'Database Architects (incl. data engineers)', group: 'Software and IT' },
  { code: '15-1244', label: 'Network and Computer Systems Administrators', group: 'Software and IT' },
  { code: '15-1232', label: 'Computer User Support Specialists', group: 'Software and IT' },
  { code: '15-1299', label: 'Computer Occupations, All Other (incl. IT project managers)', group: 'Software and IT' },
  { code: '11-3021', label: 'Computer and Information Systems Managers', group: 'Software and IT' },
  // Data
  { code: '15-2051', label: 'Data Scientists (incl. data analysts)', group: 'Data' },
  { code: '15-2041', label: 'Statisticians', group: 'Data' },
  { code: '15-2031', label: 'Operations Research Analysts', group: 'Data' },
  { code: '15-2011', label: 'Actuaries', group: 'Data' },
  // Product, design and marketing
  { code: '11-2021', label: 'Marketing Managers (incl. product managers)', group: 'Product, design and marketing' },
  { code: '13-1161', label: 'Market Research Analysts and Marketing Specialists', group: 'Product, design and marketing' },
  { code: '27-1024', label: 'Graphic Designers', group: 'Product, design and marketing' },
  { code: '27-1011', label: 'Art Directors', group: 'Product, design and marketing' },
  { code: '27-3031', label: 'Public Relations Specialists', group: 'Product, design and marketing' },
  { code: '27-3042', label: 'Technical Writers', group: 'Product, design and marketing' },
  { code: '27-3043', label: 'Writers and Authors', group: 'Product, design and marketing' },
  { code: '11-2022', label: 'Sales Managers', group: 'Product, design and marketing' },
  { code: '41-3091', label: 'Sales Representatives of Services', group: 'Product, design and marketing' },
  { code: '41-9031', label: 'Sales Engineers', group: 'Product, design and marketing' },
  // Business and consulting
  { code: '13-1111', label: 'Management Analysts (consultants, business analysts)', group: 'Business and consulting' },
  { code: '13-1082', label: 'Project Management Specialists', group: 'Business and consulting' },
  { code: '11-1021', label: 'General and Operations Managers', group: 'Business and consulting' },
  { code: '13-1081', label: 'Logisticians (supply chain)', group: 'Business and consulting' },
  { code: '13-1199', label: 'Business Operations Specialists, All Other', group: 'Business and consulting' },
  { code: '19-3011', label: 'Economists', group: 'Business and consulting' },
  // Finance
  { code: '13-2051', label: 'Financial and Investment Analysts', group: 'Finance' },
  { code: '13-2011', label: 'Accountants and Auditors', group: 'Finance' },
  { code: '13-2054', label: 'Financial Risk Specialists', group: 'Finance' },
  { code: '13-2052', label: 'Personal Financial Advisors', group: 'Finance' },
  { code: '11-3031', label: 'Financial Managers', group: 'Finance' },
  // People
  { code: '13-1071', label: 'Human Resources Specialists (incl. recruiters)', group: 'People' },
  { code: '11-3121', label: 'Human Resources Managers', group: 'People' },
  { code: '13-1151', label: 'Training and Development Specialists', group: 'People' },
  // Engineering
  { code: '17-2141', label: 'Mechanical Engineers', group: 'Engineering' },
  { code: '17-2071', label: 'Electrical Engineers', group: 'Engineering' },
  { code: '17-2061', label: 'Computer Hardware Engineers', group: 'Engineering' },
  { code: '17-2051', label: 'Civil Engineers', group: 'Engineering' },
  { code: '17-2112', label: 'Industrial Engineers', group: 'Engineering' },
  { code: '11-9041', label: 'Architectural and Engineering Managers', group: 'Engineering' },
  // Healthcare and science
  { code: '29-1141', label: 'Registered Nurses', group: 'Healthcare and science' },
  { code: '29-1171', label: 'Nurse Practitioners', group: 'Healthcare and science' },
  { code: '29-1071', label: 'Physician Assistants', group: 'Healthcare and science' },
  { code: '29-1051', label: 'Pharmacists', group: 'Healthcare and science' },
  { code: '29-1123', label: 'Physical Therapists', group: 'Healthcare and science' },
  { code: '29-1229', label: 'Physicians, All Other', group: 'Healthcare and science' },
  { code: '11-9111', label: 'Medical and Health Services Managers', group: 'Healthcare and science' },
  { code: '19-1042', label: 'Medical Scientists', group: 'Healthcare and science' },
  // Legal
  { code: '23-1011', label: 'Lawyers', group: 'Legal' },
  { code: '23-2011', label: 'Paralegals and Legal Assistants', group: 'Legal' },
  { code: '13-1041', label: 'Compliance Officers', group: 'Legal' },
];

export const COMMON_BY_CODE = new Map(COMMON_OCCUPATIONS.map((o) => [o.code, o]));
