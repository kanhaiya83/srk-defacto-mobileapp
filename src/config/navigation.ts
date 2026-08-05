import type { Ionicons } from '@expo/vector-icons';

/**
 * Single source of truth for navigation and route permissions — the mobile
 * mirror of the web client's `config/navigation.ts`.
 *
 * Both the menus and the route guards read this list, so a destination can
 * never be visible without its screen being guarded, or vice versa. The
 * `module` key matches the server's permission registry.
 */

export interface NavItem {
  /** Expo Router path. */
  path: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Permission module key. Visibility requires any permission on it. */
  module: string;
  /** Permission needed to open the screen. Defaults to `${module}:read`. */
  permission?: string;
  /** One-line explanation shown in the menu. */
  description?: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: NavItem[];
}

export const MASTERS: NavItem[] = [
  { path: '/masters/agent', label: 'Agent', icon: 'people-outline', module: 'agent', description: 'Brokers and their bank details' },
  { path: '/masters/commodity', label: 'Commodity', icon: 'leaf-outline', module: 'commodity', description: 'Traded commodities' },
  { path: '/masters/grade', label: 'Grade', icon: 'bar-chart-outline', module: 'grade', description: 'Quality grades per commodity' },
  { path: '/masters/item-rates', label: 'Item Rates', icon: 'cash-outline', module: 'item-rates', description: 'Rate per grade' },
  { path: '/masters/weigh-bridge', label: 'Weigh Bridge', icon: 'speedometer-outline', module: 'weigh-bridge', description: 'Weighing stations' },
  { path: '/masters/bag-type', label: 'Bag Type', icon: 'cube-outline', module: 'bag-type', description: 'Packaging types' },
  { path: '/masters/bag-type-config', label: 'Bag Type Config', icon: 'options-outline', module: 'bag-type-config', description: 'Size and tare per bag type' },
  { path: '/masters/bag-grade', label: 'Bag Grade', icon: 'layers-outline', module: 'bag-grade', description: 'Bag quality tiers' },
  { path: '/masters/company', label: 'Company', icon: 'business-outline', module: 'company', description: 'Billing entities' },
  { path: '/masters/company-group', label: 'Company Group', icon: 'git-merge-outline', module: 'company-group', description: 'Stock is held per group' },
  { path: '/masters/machine', label: 'Machine', icon: 'cog-outline', module: 'machine', description: 'Processing machines' },
  { path: '/masters/source-location', label: 'Source Location', icon: 'location-outline', module: 'source-location', description: 'Where goods arrive from' },
  { path: '/masters/vendor', label: 'Vendor', icon: 'person-circle-outline', module: 'vendor', description: 'Parties and contacts' },
  { path: '/masters/vendor-bank', label: 'Vendor Bank', icon: 'card-outline', module: 'vendor-bank', description: 'Vendor bank accounts' },
  { path: '/masters/warehouse-location', label: 'Warehouse', icon: 'home-outline', module: 'warehouse-location', description: 'Locations and sub-locations' },
];

export const INWARD: NavItem[] = [
  { path: '/operations/wbi-initial', label: 'WBI Loaded', icon: 'speedometer-outline', module: 'wbi', description: 'Weigh vehicles in at the gate' },
  { path: '/operations/wbi-final', label: 'WBI Empty', icon: 'speedometer', module: 'wbi', description: 'Record empty weight to close out' },
  { path: '/operations/grn', label: 'GRN', icon: 'document-text-outline', module: 'grn', description: 'Unload against a weighed vehicle' },
  { path: '/operations/inward-entry', label: 'Inward Entry', icon: 'download-outline', module: 'inward-entry', description: 'Bill and book GRN stock' },
  { path: '/operations/challan-report', label: 'Challan Report', icon: 'receipt-outline', module: 'challan-report', description: 'Inward challans' },
  { path: '/operations/prelot', label: 'Pre-Lot', icon: 'albums-outline', module: 'prelot', description: 'Allocate stock for processing' },
  { path: '/operations/lot', label: 'Lot Input', icon: 'enter-outline', module: 'lot', description: 'Consume pre-lot stock' },
  { path: '/operations/lot-output', label: 'Lot Output', icon: 'exit-outline', module: 'lot', description: 'Record processed output' },
  { path: '/operations/inventory', label: 'Inventory', icon: 'clipboard-outline', module: 'inventory', description: 'Live stock ledger' },
  { path: '/operations/bag-stock', label: 'Bag Stock', icon: 'archive-outline', module: 'bag-stock', description: 'Filled and empty bags' },
  { path: '/operations/stock-transfer', label: 'Stock Transfer', icon: 'swap-horizontal-outline', module: 'stock-transfer', description: 'Move stock between locations' },
  { path: '/operations/initial-stock', label: 'Initial Stock', icon: 'add-circle-outline', module: 'initial-stock', description: 'Opening balances' },
];

export const OUTWARD: NavItem[] = [
  { path: '/operations/saleorder', label: 'Sale Orders', icon: 'cart-outline', module: 'saleorder', description: 'Customer orders' },
  { path: '/operations/preoutward', label: 'Pre-Outwards', icon: 'file-tray-full-outline', module: 'preoutward', description: 'Reserve stock for dispatch' },
  { path: '/operations/wbo-empty', label: 'WBO Empty', icon: 'car-outline', module: 'wbo', description: 'Weigh the empty vehicle in' },
  { path: '/operations/outward', label: 'Outwards', icon: 'cloud-upload-outline', module: 'outward', description: 'Dispatch reserved stock' },
  { path: '/operations/wbo-loaded', label: 'WBO Loaded', icon: 'car-sport-outline', module: 'wbo', description: 'Weigh the loaded vehicle out' },
  {
    path: '/operations/outward-challan-report',
    label: 'Outward Challan',
    icon: 'receipt-outline',
    module: 'outward-challan-report',
    description: 'Dispatch challans',
  },
];

export const ADMIN: NavItem[] = [
  { path: '/admin/users', label: 'Users', icon: 'person-outline', module: 'user', description: 'Accounts and access' },
  { path: '/admin/roles', label: 'Roles & Permissions', icon: 'shield-checkmark-outline', module: 'role', description: 'What each role may do' },
  { path: '/admin/audit-logs', label: 'Audit Log', icon: 'time-outline', module: 'audit-log', description: 'Every change, by whom' },
];

export const NAV_SECTIONS: NavSection[] = [
  { id: 'masters', label: 'Masters', icon: 'grid-outline', items: MASTERS },
  { id: 'inward', label: 'Inward', icon: 'download-outline', items: INWARD },
  { id: 'outward', label: 'Outward', icon: 'cloud-upload-outline', items: OUTWARD },
  { id: 'administration', label: 'Administration', icon: 'shield-outline', items: ADMIN },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** Permission required to open a given path. */
export const permissionForPath = (path: string): string | undefined => {
  const item = ALL_NAV_ITEMS.find((navItem) => navItem.path === path);
  return item ? (item.permission ?? `${item.module}:read`) : undefined;
};
