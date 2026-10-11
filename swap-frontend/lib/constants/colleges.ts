/**
 * Colleges and programs from the official student masterlist (AY 2025–2026, 1st semester): main campus
 * only, bachelor's programs plus diplomas/certificates (graduate programs left out). Names as in the
 * masterlist. The code is what gets stored. Mirrors swap-backend/config/colleges.php — change both.
 */
export interface College { value: string; label: string; programs: string[] }

export const COLLEGES: College[] = [
  { value: 'COA', label: 'College of Agriculture', programs: ['BS Agribusiness Management', 'BS Agricultural Business Management', 'BS Agriculture (Major in Animal Science)', 'BS Agriculture major in Agricultural Food Processing', 'BS Agriculture major in Agronomy', 'BS Agriculture major in Extension Education', 'BSA Agricultural Extension', 'BSA Farming Systems', 'BSA Horticulture', 'BSA Soil Science', 'BSA major in Food Processing', 'DABMT-Food Processing', 'DAT Crop Production Technology'] },
  { value: 'CBAA', label: 'College of Business Administration and Accountancy', programs: ['BS Accountancy', 'BS Entrepreneurship', 'BSBA Business Economics', 'BSBA Human Resource Management', 'BSBA Marketing Management (Advertising)', 'BSBA Marketing Management (Digital Marketing)'] },
  { value: 'CED', label: 'College of Education', programs: ['BSEd English', 'BSEd Filipino', 'BSEd Mathematics', 'BSEd Sciences', 'BSEd Social Studies', 'BTLEd Home Economics', 'BTVTEd Home Economics', 'Bachelor of Early Childhood Education (BECEd)', 'Bachelor of Elementary Education (BEEd)'] },
  { value: 'CoE', label: 'College of Engineering', programs: ['BS Agricultural and Biosystems Engineering', 'BS Chemical Engineering', 'BS Civil Engineering', 'BS Civil Engineering (Structural)', 'BS Electrical Engineering', 'BS Electronics Engineering', 'BS Mechanical Engineering'] },
  { value: 'CFAS', label: 'College of Fisheries and Aquatic Sciences', programs: ['BS Fisheries', 'Diploma in Fisheries Technology (Ladderized Program) Major in Aquaculture', 'Diploma in Fisheries Technology (Ladderized Program) Major in Fish Processing'] },
  { value: 'CFES', label: 'College of Forestry and Environmental Studies', programs: ['BS Environmental Science', 'BS Forestry', 'BS Forestry major in Agroforestry'] },
  { value: 'CHS', label: 'College of Health Sciences', programs: ['BS Midwifery', 'BS Nursing', 'BS Pharmacy'] },
  { value: 'CHTM', label: 'College of Hospitality and Tourism Management', programs: ['BS Hospitality Management', 'BS Tourism Management'] },
  { value: 'CICS', label: 'College of Information and Computing Sciences', programs: ['BS Computer Science', 'BS Information Systems', 'BS Information Technology (Database Systems)', 'BS Information Technology (Network Systems)'] },
  { value: 'CNSM', label: 'College of Natural Sciences and Mathematics', programs: ['BS Biology (Animal Biology)', 'BS Chemistry', 'BS Mathematics', 'BS Physics', 'BS Statistics', 'Certificate in Statistics'] },
  { value: 'CPA', label: 'College of Public Affairs', programs: ['BS Social Work', 'BS Sustainable Community Development', 'Bachelor of Public Administration'] },
  { value: 'CSSH', label: 'College of Social Sciences and Humanities', programs: ['AB Communication Studies major in Devt. Com.', 'AB Communication Studies major in Journalism', 'BA Communication Studies (Media Education)', 'BA English Language Studies', 'BA Filipino', 'BA History International History Track', 'BA History Philippine and Asian History Track', 'BA History Public History/Development Track', 'BA Journalism', 'BA Literary and Cultural Studies', 'BA Panitikan', 'BA Philosophy', 'BA Political Science', 'BA Psychology', 'BA Sociology', 'BS Development Communication', 'BS Psychology', 'Bachelor of Library and Information Science'] },
  { value: 'CSPEAR', label: 'College of Sports, Physical Education and Recreation', programs: ['BS Physical Education'] },
  { value: 'DET', label: 'Division of Engineering Technology', programs: ['BSET Construction Engineering Management', 'BSET Electrical and Renewable Energy', 'BSET Machining and Fabrication', 'DT Machine Shop Technology', 'Diploma in Electrical Technology major in Renewable Energy', 'Diploma in Technology Major in Construction Technology'] },
  { value: 'KFCIAAS', label: 'King Faisal Center for Islamic, Arabic and Asian Studies', programs: ['AB Islamic Studies major in Shariah', 'BS International Relations', 'BS Islamic Banking and Finance', 'BS Teaching Arabic'] },
]

/** 'College of Agriculture' for 'COA'; anything not on the list is returned as saved. */
export const collegeLabel = (code: string | null | undefined): string | null =>
  code ? COLLEGES.find((c) => c.value === code)?.label ?? null : null

/** How a college reads in lists: "COA — College of Agriculture" (the code as stored otherwise, e.g. an old value). */
export const collegeDisplay = (code: string | null | undefined): string => {
  if (!code) return '—'
  const label = collegeLabel(code)
  return label ? `${code.toUpperCase()} — ${label}` : code
}
