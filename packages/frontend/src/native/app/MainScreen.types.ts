import { ComponentProps } from 'react';
import { DesktopPosScreen, MobilePosScreen } from '../components';
import { MenuItem, PaidTicket, SessionSummary } from '../types';

export type AppSection = 'home' | 'pos' | 'history' | 'products';
export type PosScreenProps = ComponentProps<typeof DesktopPosScreen> & ComponentProps<typeof MobilePosScreen>;

export interface MainScreenProps {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  onLogout: () => void;
  posScreenProps: PosScreenProps;
  sessionSummary: SessionSummary | null;
  filteredPaidTickets: PaidTicket[];
  ticketSearchText: string;
  setTicketSearchText: (value: string) => void;
  refreshSessionSummary: (showFeedback?: boolean) => Promise<void>;
  loadTicketHistory: () => Promise<void>;
  printSimplifiedPaidTicket: (ticket: PaidTicket) => Promise<void>;
  downloadTicket: (ticket: PaidTicket) => Promise<void>;
  managedCategories: string[];
  managedMenuItems: MenuItem[];
  productName: string;
  setProductName: (value: string) => void;
  productCategory: string;
  setProductCategory: (value: string) => void;
  productPrice: string;
  setProductPrice: (value: string) => void;
  productCost: string;
  setProductCost: (value: string) => void;
  productSku: string;
  setProductSku: (value: string) => void;
  productDescription: string;
  setProductDescription: (value: string) => void;
  productImageDataUrl: string | null;
  setProductImageDataUrl: (value: string | null) => void;
  importProductsCsv: () => void;
  chooseProductImage: (onSelected: (imageDataUrl: string) => void) => Promise<void>;
  saveNewProduct: () => Promise<void>;
  updateProductCategory: (item: MenuItem, value: string) => Promise<void>;
  updateProductPrice: (item: MenuItem, value: string) => Promise<void>;
  updateProductCost: (item: MenuItem, value: string) => Promise<void>;
  updateProductImage: (item: MenuItem) => Promise<void>;
  removeProductImage: (item: MenuItem) => Promise<void>;
  formatDateTime: (value: string) => string;
  centsToCurrency: (cents: number) => string;
}

