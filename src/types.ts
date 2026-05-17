export interface IDCardData {
  id?: string; // Firebase uses string IDs
  fullName: string;
  fatherName: string;
  motherName: string;
  birthDateAndPlace: string;
  birthDate?: string; // Separate field for easier filtering
  gender: 'M' | 'F' | 'Other';
  civilStatus: string;
  profession: string;
  address: string;
  idNumber: string;
  entryDateChina: string;
  documentPresented: string;
  issueDate: string;
  expiryDate: string;
  photo: string; // base64
  fingerprint: string; // base64
  signature: string; // base64
  created_at: string;
  registrationType?: 'Nova Emissão' | 'Renovação' | 'Duplicado' | 'Suplementar';
  created_by_id?: string;
  created_by_name?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  photo?: string;
  role: 'admin' | 'operator';
  permissions?: string[]; // E.g. ['view_cards', 'create_cards', 'manage_templates', 'admin_access']
  created_at?: string;
}

export interface MenuLink {
  label: string;
  url: string;
}

export interface SystemSettings {
  id: string;
  systemName: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  logo: string;
  loginBackground?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  loginWelcomeLabel?: string;
  loginFooterText?: string;
  removeBgApiKey?: string;
  menuLinks?: MenuLink[];
  headingFont?: string;
  bodyFont?: string;
  customFontName?: string;
  customFontData?: string;
  privacyUrl?: string;
  termsUrl?: string;
  supportUrl?: string;
  version?: string;
  updatesHistory?: Array<{
    version: string;
    date: string;
    changes: string;
    type: 'major' | 'minor' | 'patch';
  }>;
}

export interface ElementPosition {
  top: number;
  left: number;
  fontSize?: number;
  width?: number;
  height?: number;
}

export interface LayoutSettings {
  front: {
    [key: string]: ElementPosition;
  };
  back: {
    [key: string]: ElementPosition;
  };
  fontFamily?: string;
  customFonts?: Array<{
    name: string;
    data: string;
  }>;
}
