/**
 * Color Theme - Blue-based Design System
 * 
 * A unified color palette for the entire application.
 * All components should reference these constants instead of hardcoded values.
 */

export const colors = {
  // Primary Colors (Blue-based)
  primary: '#1D4ED8',        // Main blue for primary actions
  primaryLight: '#3B82F6',   // Lighter blue for highlights
  primaryDark: '#1E40AF',    // Darker blue for emphasis
  primaryAccent: '#60A5FA',  // Accent blue for secondary elements
  
  // Background Colors
  background: '#F4F6F8',     // Main app background (light gray-blue)
  surface: '#FFFFFF',        // Cards, panels, elevated surfaces
  surfaceAlt: '#F9FAFB',     // Alternate surface (very light gray)
  
  // Text Colors
  text: '#111827',           // Primary text color (dark gray)
  textSecondary: '#4B5563',  // Secondary text (medium gray)
  textTertiary: '#6B7280',   // Tertiary text (lighter gray)
  textLight: '#FFFFFF',      // Text on dark backgrounds
  textBlack: '#000000',      // Pure black when needed
  
  // Border & Divider Colors
  border: '#E5E7EB',         // Default borders
  borderLight: '#F1F5F9',    // Light borders/dividers
  borderDark: '#D1D5DB',     // Darker borders for emphasis
  
  // Button & Interactive Colors
  buttonPrimary: '#1D4ED8',       // Primary button background
  buttonPrimaryText: '#FFFFFF',   // Primary button text
  buttonSecondary: '#E5E7EB',     // Secondary button background
  buttonSecondaryText: '#111827', // Secondary button text
  
  // Zone/Category Colors (Blue theme variants)
  zoneTable: '#4869F7',      // Table zone background (vibrant blue)
  zoneMenu: '#2563EB',       // Menu category background (medium blue)
  
  // Semantic Colors
  success: '#10B981',        // Success states (green)
  warning: '#F59E0B',        // Warning states (amber)
  error: '#EF4444',          // Error states (red)
  info: '#3B82F6',           // Info states (blue)
  
  // Input Colors
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputText: '#111827',
  inputPlaceholder: '#9CA3AF',
} as const;

export type ColorKey = keyof typeof colors;
