// lib/jobs/fit.ts
//
// How a job posting fits a student's resume, without a model: which named
// skills the posting asks for and which of them the resume has, and what the
// posting itself says about sponsorship, citizenship, clearance and years of
// experience, quoted. The score is a count (skills found on the resume out of
// skills in the posting), so it can be traced to both texts.

import { hasTerm } from '@/lib/applications/truthful-tailor';

/**
 * Named skills, tools and methods. Each entry is the label shown, then other
 * spellings. A term starting with = must match with the same capitals, for
 * names that are also ordinary words (Swift, Excel, Spark). Words that are
 * mostly ordinary words (R, C, Go, Node, Spring, REST) are left out or only
 * matched in an unambiguous spelling.
 */
const SKILLS: [string, ...string[]][] = [
  // Languages
  ['Python'], ['Java'], ['JavaScript'], ['TypeScript'], ['C++', 'CPP'], ['C#', 'C Sharp'], ['Golang'], ['=Rust'], ['Kotlin'], ['=Swift'],
  ['Scala'], ['=Ruby'], ['PHP'], ['MATLAB'], ['=SAS'], ['=Julia'], ['Perl'], ['Bash', 'Shell scripting'], ['PowerShell'], ['Objective-C'], ['=Dart'],
  ['Verilog'], ['VHDL'], ['Solidity'], ['Haskell'], ['Elixir'], ['Lua'], ['Assembly Language', 'x86 Assembly', 'ARM Assembly'],
  // Data
  ['SQL'], ['MySQL'], ['PostgreSQL', 'Postgres'], ['SQLite'], ['Oracle Database', 'Oracle DB', 'PL/SQL'], ['SQL Server', 'MSSQL', 'T-SQL'], ['MongoDB'],
  ['NoSQL'], ['Redis'], ['Cassandra'], ['DynamoDB'], ['Elasticsearch', 'OpenSearch'], ['Snowflake'], ['BigQuery'], ['Redshift'], ['Databricks'],
  ['=Spark', 'PySpark', 'Apache Spark'], ['Hadoop'], ['=Hive', 'Apache Hive'], ['Kafka'], ['Airflow'], ['dbt'], ['ETL', 'ELT'], ['Data Warehousing', 'Data Warehouse'],
  ['Data Modeling', 'Data Modelling'], ['Data Pipelines', 'Data Pipeline'], ['Pandas'], ['NumPy'], ['SciPy'], ['=Excel', 'Microsoft Excel', 'MS Excel'],
  ['VBA'], ['Power Query'], ['DAX'], ['Tableau'], ['Power BI'], ['Looker'], ['Qlik'], ['Metabase'], ['Mode Analytics'], ['Alteryx'], ['SPSS'], ['Stata'],
  ['Matplotlib'], ['Seaborn'], ['Plotly'], ['D3.js'], ['Data Visualization', 'Data Visualisation'], ['Statistics', 'Statistical Analysis'],
  ['A/B Testing', 'AB Testing', 'Experimentation'], ['Hypothesis Testing'], ['Regression'], ['Forecasting'], ['Time Series'], ['Data Cleaning'],
  ['Data Analysis', 'Data Analytics'], ['Business Intelligence'], ['Dashboards', 'Dashboarding'], ['KPI'], ['Google Analytics'], ['Amplitude'], ['Mixpanel'],
  // ML and AI
  ['Machine Learning', 'ML'], ['Deep Learning'], ['Natural Language Processing', 'NLP'], ['Computer Vision'], ['Reinforcement Learning'],
  ['TensorFlow'], ['PyTorch'], ['Keras'], ['Scikit-learn', 'sklearn', 'scikit learn'], ['XGBoost'], ['LightGBM'], ['Hugging Face', 'HuggingFace', 'Transformers'],
  ['LLM', 'LLMs', 'Large Language Models'], ['Generative AI', 'GenAI'], ['=RAG', 'Retrieval-Augmented Generation'], ['LangChain'], ['Prompt Engineering'],
  ['OpenCV'], ['MLOps'], ['Feature Engineering'], ['Recommendation Systems', 'Recommender Systems'], ['Neural Networks'], ['Classification'], ['Clustering'],
  // Cloud and infrastructure
  ['AWS', 'Amazon Web Services'], ['Azure', 'Microsoft Azure'], ['GCP', 'Google Cloud', 'Google Cloud Platform'], ['S3'], ['EC2'], ['=Lambda', 'AWS Lambda'],
  ['Docker'], ['Kubernetes', 'K8s'], ['Terraform'], ['Ansible'], ['CI/CD', 'Continuous Integration'], ['Jenkins'], ['GitHub Actions'], ['GitLab CI'],
  ['Linux', 'Unix'], ['Git'], ['Microservices'], ['Serverless'], ['Computer Networking', 'Network Engineering'], ['TCP/IP'], ['Distributed Systems'], ['System Design'],
  ['Observability'], ['Prometheus'], ['Grafana'], ['Datadog'], ['Splunk'], ['Firebase'], ['Supabase'], ['Vercel'], ['Heroku'],
  // Web and mobile
  ['React', 'React.js', 'ReactJS'], ['Next.js', 'NextJS'], ['Vue.js', '=Vue'], ['=Angular', 'AngularJS'], ['Svelte'], ['Node.js', 'NodeJS'], ['Express.js', 'ExpressJS'],
  ['Django'], ['Flask'], ['FastAPI'], ['Spring Boot', 'Spring Framework'], ['Ruby on Rails'], ['.NET', 'ASP.NET', 'dotnet'], ['GraphQL'], ['REST APIs', 'REST API', 'RESTful'],
  ['HTML'], ['CSS'], ['Tailwind', 'Tailwind CSS'], ['Redux'], ['Webpack'], ['iOS'], ['Android'], ['React Native'], ['Flutter'], ['SwiftUI'],
  ['Unit Testing'], ['Jest'], ['Cypress'], ['Selenium'], ['Playwright'], ['Pytest'], ['JUnit'],
  // Security and hardware
  ['Cybersecurity', 'Information Security'], ['Penetration Testing'], ['SIEM'], ['=IAM'], ['Cryptography'], ['Embedded Systems', 'Embedded Software', 'Firmware'],
  ['FPGA'], ['PCB Design', 'PCB'], ['Circuit Design'], ['Microcontrollers'], ['RTOS'], ['=CAD'], ['SolidWorks'], ['AutoCAD'], ['Simulink'], ['LabVIEW'], ['ROS'],
  // Product, design and business
  ['Product Management'], ['=Agile'], ['Scrum'], ['Jira'], ['Confluence'], ['Roadmapping', 'Product Roadmap'], ['User Research'], ['UX Design', 'UX'],
  ['UI Design'], ['Figma'], ['=Sketch'], ['Adobe XD'], ['Prototyping'], ['Wireframing'], ['Usability Testing'], ['Design Systems'],
  ['Salesforce'], ['HubSpot'], ['CRM'], ['SAP'], ['NetSuite'], ['QuickBooks'], ['Financial Modeling', 'Financial Modelling'], ['Valuation'],
  ['Accounting'], ['FP&A'], ['Budgeting'], ['Market Research'], ['Competitive Analysis'], ['SEO'], ['SEM'], ['Google Ads'], ['Content Marketing'],
  ['Digital Marketing'], ['Email Marketing'], ['Social Media Marketing'], ['Copywriting'], ['Project Management'], ['Stakeholder Management'], ['Six Sigma'],
  ['=Lean'], ['Supply Chain'], ['Operations Management'], ['Process Improvement'], ['Root Cause Analysis'], ['Business Analysis'], ['Requirements Gathering'],
  ['Public Speaking'], ['Presentation Skills'], ['Technical Writing'],
];

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** True when the text names the term; =Term matches only with its capitals, as a whole word. */
function names(text: string, term: string): boolean {
  if (!term.startsWith('=')) return hasTerm(text, term);
  return new RegExp('(^|[^A-Za-z0-9])' + esc(term.slice(1)) + '(s)?($|[^A-Za-z0-9+#])').test(text);
}
const label = (entry: string[]) => entry[0].replace(/^=/, '');

export interface FitFlag {
  kind: 'no-sponsorship' | 'citizen-only' | 'clearance';
  /** The sentence from the posting that says it. */
  quote: string;
}

export interface JobFit {
  /** Skills from SKILLS the posting names. */
  skills: string[];
  /** Of those, the ones on the resume. */
  matched: string[];
  missing: string[];
  /** matched / skills as a whole percent, or null when too few skills are named to say. */
  score: number | null;
  flags: FitFlag[];
  /** "3+ years of experience", as written, when the posting asks for it. */
  years: { min: number; quote: string } | null;
}

/** Fewest named skills before a score is shown. */
export const MIN_SKILLS_FOR_SCORE = 3;

function sentences(text: string): string[] {
  // Abbreviations with periods ("U.S.", "e.g.") would otherwise end a sentence.
  const t = text.replace(/\s+/g, ' ')
    .replace(/\bU\.\s?S\.(\s?A\.)?/g, 'US').replace(/\b(e\.g|i\.e|etc|vs|incl)\./gi, '$1');
  return t.split(/(?<=[.!?;•])\s+|\s+[•\-–]\s+/).map(s => s.trim()).filter(Boolean);
}

const NO_SPONSOR = [
  /\b(not|unable to|cannot|can't|won't|will not|do not|does not|don't|doesn't)\s+(be\s+)?(able\s+to\s+)?(provide|offer|sponsor|support|consider)\b[^.]{0,60}\b(sponsor|visa|immigration)/i,
  /\bwithout\s+(the\s+)?(need\s+for\s+)?(current\s+or\s+future\s+|now\s+or\s+in\s+the\s+future\s+)?(visa\s+|employer\s+|employment\s+)?sponsorship/i,
  /\bno\s+(visa\s+|immigration\s+)?sponsorship\b/i,
  /\bsponsorship\s+(is\s+)?(not\s+(available|provided|offered)|unavailable)/i,
  /\bnot\s+eligible\s+for\s+(visa\s+)?sponsorship/i,
];
const CITIZEN = [
  /\bmust\s+be\s+(a\s+)?(u\.?\s?s\.?|united\s+states)\s+citizen/i,
  /\b(u\.?\s?s\.?|united\s+states)\s+citizenship\s+(is\s+)?required/i,
  /\bonly\s+(u\.?\s?s\.?|united\s+states)\s+citizens\b/i,
  /\brequires?\s+(u\.?\s?s\.?|united\s+states)\s+citizenship/i,
];
const CLEARANCE = [/\b(active\s+)?(security|secret|top\s+secret)\s+clearance\b/i, /\bTS\/SCI\b/, /\bpublic\s+trust\b/i];
const YEARS = /\b(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?\+?\s*years?\s+(?:of\s+)?(?:(?:professional|relevant|related|industry|hands-on|full-time|work|working)\s+)*experience/i;

const quoteFor = (all: string[], patterns: RegExp[]) => all.find(s => patterns.some(p => p.test(s)));
const short = (s: string) => (s.length > 220 ? `${s.slice(0, 217)}...` : s);

/** What a posting asks for and says, against the resume's text. */
export function jobFit(description: string, resumeText: string | null): JobFit {
  const all = sentences(description);
  const found = SKILLS.filter(entry => entry.some(t => names(description, t)));
  const skills = found.map(label);
  const matched = resumeText ? found.filter(entry => entry.some(t => names(resumeText, t))).map(label) : [];

  const flags: FitFlag[] = [];
  const ns = quoteFor(all, NO_SPONSOR); if (ns) flags.push({ kind: 'no-sponsorship', quote: short(ns) });
  const ct = quoteFor(all, CITIZEN); if (ct) flags.push({ kind: 'citizen-only', quote: short(ct) });
  const cl = quoteFor(all, CLEARANCE); if (cl) flags.push({ kind: 'clearance', quote: short(cl) });

  const ySentence = all.find(s => YEARS.test(s));
  const yMatch = ySentence?.match(YEARS);

  return {
    skills,
    matched,
    missing: skills.filter(s => !matched.includes(s)),
    score: resumeText && skills.length >= MIN_SKILLS_FOR_SCORE ? Math.round((matched.length / skills.length) * 100) : null,
    flags,
    years: yMatch && ySentence ? { min: Number(yMatch[1]), quote: short(ySentence) } : null,
  };
}
